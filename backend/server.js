require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ── DATABASE ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255),
      current_mood VARCHAR(50) DEFAULT 'default',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      mood TEXT DEFAULT 'default',
      mood_label VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // add current_mood column if it doesn't exist (for existing DBs)
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS current_mood TEXT DEFAULT 'default'`);
  // expand mood columns if they were created small
  await pool.query(`ALTER TABLE messages ALTER COLUMN mood TYPE TEXT`);
  await pool.query(`ALTER TABLE conversations ALTER COLUMN current_mood TYPE TEXT`);
  console.log('✅ Database ready');
}
initDB();

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── SYSTEM PROMPT ──
function buildSystemPrompt(currentMoodData) {
  return `You are AURA, an expressive AI assistant.

IMPORTANT: You MUST follow this exact response format. No exceptions.

STEP 1: Answer the user question in a helpful and natural way.

STEP 2: After your answer, write exactly this on a new line:
MOOD_JSON_START
Then write a JSON object with these exact keys, then write:
MOOD_JSON_END

The JSON must have these exact keys with creative values matching the topic:
- moodLabel: 2-4 word poetic vibe description
- emoji: single emoji perfectly matching topic
- bgColor1: MUST be a Dark hex color matching topic emotion
- bgColor2: MUST be a Dark hex color 
- bgColor3: MUST be a Dark hex color
- borderColor: bright vibrant hex color matching topic
- glowRGB: R,G,B numbers matching borderColor`;
}

// ── GEMINI API CALL ──
async function callGemini(contents, systemPrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
      })
    }
  );
  const data = await res.json();
  if (data.error) { console.error('Gemini error detail:', JSON.stringify(data.error)); throw new Error('gemini_error'); }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) { console.error('Gemini empty response:', JSON.stringify(data)); throw new Error('gemini_empty'); }
  return text;
}

// ── OPENAI-COMPATIBLE API CALL (used by Groq, NVIDIA, OpenRouter) ──
async function callOpenAICompatible(name, baseURL, apiKey, model, messages, systemPrompt) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.parts ? m.parts[0].text : m.content
        }))
      ],
      temperature: 0.9,
      max_tokens: 1024
    })
  });
  const data = await res.json();
  if (data.error) { console.error(`${name} error:`, JSON.stringify(data.error)); throw new Error(`${name}_error`); }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) { console.error(`${name} empty response`); throw new Error(`${name}_empty`); }
  return text;
}

async function callGroq(messages, systemPrompt) {
  return callOpenAICompatible('Groq', 'https://api.groq.com/openai/v1', process.env.GROQ_API_KEY, 'llama-3.1-8b-instant', messages, systemPrompt);
}

async function callNvidia1(messages, systemPrompt) {
  // nemotron is a reasoning model - different response format
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY_1}`
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.parts ? m.parts[0].text : m.content
        }))
      ],
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 1024,
      stream: false
    })
  });
  const data = await res.json();
  console.log('Nvidia1 raw response:', JSON.stringify(data).substring(0, 300));
  if (data.error) { console.error('Nvidia1 error:', JSON.stringify(data.error)); throw new Error('nvidia1_error'); }
  // reasoning model returns content OR reasoning_content
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '';
  if (!text) throw new Error('nvidia1_empty');
  return text;
}

async function callNvidia2(messages, systemPrompt) {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY_2}`
    },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.parts ? m.parts[0].text : m.content
        }))
      ],
      temperature: 0.9,
      max_tokens: 1024,
      stream: false
    })
  });
  const data = await res.json();
  console.log('Nvidia2 raw response:', JSON.stringify(data).substring(0, 300));
  if (data.error) { console.error('Nvidia2 error:', JSON.stringify(data.error)); throw new Error('nvidia2_error'); }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('nvidia2_empty');
  return text;
}

// ── CALL AI WITH FALLBACK (4 APIs) ──
async function callAI(contents, systemPrompt) {
  const providers = [
    { name: 'Gemini',  fn: () => callGemini(contents, systemPrompt) },
    { name: 'Groq',    fn: () => callGroq(contents, systemPrompt) },
    { name: 'Nvidia1', fn: () => callNvidia1(contents, systemPrompt) },
    { name: 'Nvidia2', fn: () => callNvidia2(contents, systemPrompt) },
  ];

  for (const provider of providers) {
    try {
      console.log(`trying ${provider.name}...`);
      const result = await provider.fn();
      console.log(`${provider.name} success ✅`);
      return result;
    } catch(e) {
      console.log(`${provider.name} failed, trying next...`);
    }
  }

  throw new Error('service_unavailable');
}

// ── PARSE AI RESPONSE ──
function parseResponse(raw) {
  const DEFAULT = {
    moodLabel: '',
    emoji: '✨',
    bgColor1: '#0d0d2b',
    bgColor2: '#1a1040',
    bgColor3: '#0d1a2b',
    borderColor: '#7c6aff',
    glowRGB: '124,106,255'
  };

  let moodData = { ...DEFAULT };
  let answer = raw;

  // fix unquoted emojis: "emoji": 😄 → "emoji": "😄"
  function fixJSON(str) {
    return str.replace(/"emoji"\s*:\s*([^"\s,}][^,}]*?)([,}])/g, (match, val, end) => {
      const trimmed = val.trim();
      if (trimmed.startsWith('"')) return match; // already quoted
      return `"emoji": "${trimmed}"${end}`;
    });
  }

  // try MOOD_JSON_START/END markers first
  const markerMatch = raw.match(/MOOD_JSON_START\s*([\s\S]*?)\s*MOOD_JSON_END/);
  if (markerMatch) {
    try {
      const fixed = fixJSON(markerMatch[1].trim());
      const parsed = JSON.parse(fixed);
      moodData = { ...DEFAULT, ...parsed };
      answer = raw.replace(/MOOD_JSON_START[\s\S]*?MOOD_JSON_END/, '').trim();
      console.log('Parsed mood:', JSON.stringify(moodData));
      return { answer, moodData };
    } catch(e) { console.error('Marker JSON parse error:', e.message); }
  }

  // fallback: find any JSON block with moodLabel
  const jsonMatch = raw.match(/\{[\s\S]*?"moodLabel"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const fixed = fixJSON(jsonMatch[0]);
      const parsed = JSON.parse(fixed);
      moodData = { ...DEFAULT, ...parsed };
      answer = raw.replace(jsonMatch[0], '').trim();
      console.log('Parsed mood fallback:', JSON.stringify(moodData));
    } catch(e) { console.error('JSON parse error:', e.message); }
  }

  return { answer, moodData };
}

// ── REGISTER ──
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username.toLowerCase().trim(), hashed]
    );
    const token = jwt.sign({ id: result.rows[0].id, username: result.rows[0].username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: result.rows[0].username });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── LOGIN ──
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]);
    if (!result.rows.length) return res.status(400).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, result.rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: result.rows[0].id, username: result.rows[0].username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: result.rows[0].username });
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── NEW CONVERSATION ──
app.post('/conversations', auth, async (req, res) => {
  const { title } = req.body;
  const result = await pool.query(
    'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
    [req.user.id, title || 'New Chat']
  );
  res.json(result.rows[0]);
});

// ── GET ALL CONVERSATIONS ──
app.get('/conversations', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(result.rows);
});

// ── DELETE CONVERSATION ──
app.delete('/conversations/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// ── GET MESSAGES ──
app.get('/conversations/:id/messages', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [req.params.id]
  );
  res.json(result.rows);
});

// ── CHAT ──
app.post('/chat', auth, async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  // save user message
  await pool.query(
    'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
    [conversationId, 'user', message]
  );

  // get current mood data of conversation
  const convResult = await pool.query('SELECT current_mood FROM conversations WHERE id = $1', [conversationId]);
  let currentMoodData = {};
  try { currentMoodData = JSON.parse(convResult.rows[0]?.current_mood || '{}'); } catch(e) {}

  // get conversation history
  const history = await pool.query(
    'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );

  // build contents (fix alternating roles for Gemini)
  const rawHistory = history.rows.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  const contents = [];
  let lastRole = null;
  for (const msg of rawHistory) {
    if (msg.role === lastRole) {
      contents[contents.length - 1].parts[0].text += '\n' + msg.parts[0].text;
    } else {
      contents.push({ role: msg.role, parts: [{ text: msg.parts[0].text }] });
      lastRole = msg.role;
    }
  }
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: message }] });
  }

  try {
    const raw = await callAI(contents, buildSystemPrompt(currentMoodData));
    const { answer, moodData } = parseResponse(raw);
    console.log('Parsed mood:', JSON.stringify(moodData));

    // save AI message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, mood, mood_label) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, 'assistant', answer, JSON.stringify(moodData), moodData.moodLabel || '']
    );

    // update conversation mood + title
    await pool.query('UPDATE conversations SET current_mood = $1 WHERE id = $2', [JSON.stringify(moodData), conversationId]);
    const count = await pool.query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversationId]);
    if (parseInt(count.rows[0].count) <= 2) {
      const title = message.length > 40 ? message.substring(0, 40) + '...' : message;
      await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [title, conversationId]);
    }

    res.json({ answer, moodData });

  } catch(e) {
    // never reveal which AI failed — always show friendly message
    console.error('All AI services failed:', e.message);

    const friendlyMessages = [
      "I'm having a moment of deep thought... Please try again!",
      "The network seems a bit busy right now. Try again in a moment!",
      "I'm gathering my thoughts. Please send that again!",
      "Connection hiccup! Please try once more.",
    ];
    const friendly = friendlyMessages[Math.floor(Math.random() * friendlyMessages.length)];
    const moodJson = JSON.stringify(currentMoodData);

    // save friendly message so chat history looks clean
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, mood, mood_label) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, 'assistant', friendly, moodJson, '']
    );

    res.json({ answer: friendly, moodData: currentMoodData });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AURA backend running on port ${PORT}`));
