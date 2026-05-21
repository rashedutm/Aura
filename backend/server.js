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
      mood VARCHAR(50) DEFAULT 'default',
      mood_label VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // add current_mood column if it doesn't exist (for existing DBs)
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS current_mood VARCHAR(50) DEFAULT 'default'`);
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
function buildSystemPrompt(currentMood) {
  return `You are AURA, a warm, insightful and expressive AI assistant.
Answer the user's question thoughtfully and naturally.

After your answer, on a NEW LINE return ONLY this JSON (no extra text after it):
{"mood":"<one word>","moodLabel":"<2-3 word label>"}

MOOD PERSISTENCE RULES:
- The current conversation mood is: "${currentMood}"
- Only change the mood if the topic has CLEARLY and SIGNIFICANTLY shifted
- Small topic changes should keep the same mood
- If the user keeps talking about the same general theme, keep the mood
- Only switch mood for obvious topic changes (e.g. was talking about love, now asking about coding)

MOOD OPTIONS - pick the most fitting:
- love → romance, relationships, feelings, dating, crush, heart, affection
- space → universe, stars, planets, astronomy, cosmos, galaxy, sci-fi
- nature → plants, animals, environment, forest, earth, trees, outdoors
- ocean → water, sea, beach, waves, marine, fish, sailing, underwater
- fire → motivation, energy, passion, anger, heat, excitement, hustle, sports
- mystery → secrets, unknown, paranormal, conspiracy, thriller, crime, detective
- happy → joy, celebration, fun, humor, comedy, party, games, entertainment
- sad → grief, loss, depression, loneliness, heartbreak, pain, struggle
- tech → coding, computers, AI, software, hardware, programming, internet, gadgets
- food → eating, cooking, recipes, restaurants, cuisine, drink, nutrition
- music → songs, artists, concerts, instruments, genres, lyrics, bands
- default → ONLY for truly generic greetings or completely unclear questions

Be decisive! Always pick a specific mood. Avoid default as much as possible.`;
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

// ── GROQ API CALL ──
async function callGroq(messages, systemPrompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
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
  if (data.error) { console.error('Groq error detail:', JSON.stringify(data.error)); throw new Error('groq_error'); }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) { console.error('Groq empty response:', JSON.stringify(data)); throw new Error('groq_empty'); }
  return text;
}

// ── CALL AI WITH FALLBACK ──
async function callAI(contents, systemPrompt) {
  // try Gemini first
  try {
    console.log('trying Gemini...');
    const result = await callGemini(contents, systemPrompt);
    console.log('Gemini success ✅');
    return result;
  } catch(e) {
    console.log('Gemini failed, trying Groq...');
  }

  // fallback to Groq
  try {
    const result = await callGroq(contents, systemPrompt);
    console.log('Groq success ✅');
    return result;
  } catch(e) {
    console.log('Groq failed too ❌');
  }

  throw new Error('service_unavailable');
}

// ── PARSE AI RESPONSE ──
function parseResponse(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*?"mood"[\s\S]*?\}/);
  let mood = 'default', moodLabel = '';
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      mood = parsed.mood || 'default';
      moodLabel = parsed.moodLabel || '';
    } catch(e) {}
  }
  const answer = raw.replace(/\{[\s\S]*?"mood"[\s\S]*?\}/, '').trim();
  return { answer, mood, moodLabel };
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

  // get current mood of conversation
  const convResult = await pool.query('SELECT current_mood FROM conversations WHERE id = $1', [conversationId]);
  const currentMood = convResult.rows[0]?.current_mood || 'default';

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
    const raw = await callAI(contents, buildSystemPrompt(currentMood));
    const { answer, mood, moodLabel } = parseResponse(raw);

    // save AI message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, mood, mood_label) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, 'assistant', answer, mood, moodLabel]
    );

    // update conversation mood + title
    await pool.query('UPDATE conversations SET current_mood = $1 WHERE id = $2', [mood, conversationId]);
    const count = await pool.query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversationId]);
    if (parseInt(count.rows[0].count) <= 2) {
      const title = message.length > 40 ? message.substring(0, 40) + '...' : message;
      await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [title, conversationId]);
    }

    res.json({ answer, mood, moodLabel });

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

    // save friendly message so chat history looks clean
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, mood, mood_label) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, 'assistant', friendly, currentMood, '']
    );

    res.json({ answer: friendly, mood: currentMood, moodLabel: '' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AURA backend running on port ${PORT}`));
