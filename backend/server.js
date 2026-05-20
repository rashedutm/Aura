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

// ── INIT TABLES ──
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
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Server error' });
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
    res.status(500).json({ error: 'Server error' });
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

  // get conversation history for context
  const history = await pool.query(
    'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );

  const systemPrompt = `You are AURA, a warm, insightful and expressive AI assistant.
Answer the user's question thoughtfully and naturally.
After your answer, on a NEW LINE return ONLY this JSON (no extra text after it):
{"mood":"<one word: love,space,nature,ocean,fire,mystery,happy,sad,tech,food,music,default>","moodLabel":"<2-3 word friendly label like 'romantic vibes' or 'cosmic wonder'>"}
Pick the mood that best matches the emotional tone of the conversation.`;

  // build messages array for Gemini
  // Gemini needs alternating user/model, no consecutive same roles
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
    console.log('Calling Gemini API...');
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

    const data = await geminiRes.json();
    console.log('Gemini response status:', geminiRes.status);

    if (data.error) {
      console.error('Gemini error:', data.error);
      return res.status(500).json({ error: 'Gemini API error: ' + data.error.message });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Raw response length:', raw.length);

    // extract JSON mood
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

    // save AI message
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, mood, mood_label) VALUES ($1, $2, $3, $4, $5)',
      [conversationId, 'assistant', answer, mood, moodLabel]
    );

    // update conversation title from first message
    const count = await pool.query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversationId]);
    if (parseInt(count.rows[0].count) <= 2) {
      const title = message.length > 40 ? message.substring(0, 40) + '...' : message;
      await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [title, conversationId]);
    }

    res.json({ answer, mood, moodLabel });
  } catch(e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AURA backend running on port ${PORT}`));
