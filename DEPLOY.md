# AURA — Render Deployment Guide

## FOLDER STRUCTURE
```
aura/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── index.js
    │   └── index.css
    ├── public/
    │   └── index.html
    ├── package.json
    └── .env.example
```

---

## STEP 1 — Push to GitHub

Push the whole `aura` folder to a GitHub repo.
Make sure you push BOTH backend and frontend folders.

---

## STEP 2 — Create PostgreSQL Database on Render

1. Go to render.com → New → PostgreSQL
2. Name: aura-db
3. Plan: Free
4. Click Create Database
5. Copy the "Internal Database URL" → you need this later!

---

## STEP 3 — Deploy Backend on Render

1. Render → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Name: aura-backend
   - Root Directory: backend
   - Build Command: npm install
   - Start Command: node server.js
   - Plan: Free

4. Add Environment Variables:
   - DATABASE_URL → paste your PostgreSQL Internal URL from Step 2
   - JWT_SECRET   → type any long random string (e.g. aura2024superSecretKey123xyz)
   - GEMINI_API_KEY → paste your Gemini API key from aistudio.google.com

5. Click Deploy!
6. Copy your backend URL → looks like: https://aura-backend.onrender.com

---

## STEP 4 — Deploy Frontend on Render

1. Render → New → Static Site
2. Connect same GitHub repo
3. Settings:
   - Name: aura-frontend
   - Root Directory: frontend
   - Build Command: npm install && npm run build
   - Publish Directory: build

4. Add Environment Variable:
   - REACT_APP_API_URL → paste your backend URL from Step 3
     example: https://aura-backend.onrender.com

5. Click Deploy!

---

## DONE! 🎉

Your app is live at: https://aura-frontend.onrender.com

- Everyone can register with username + password
- Chat history is saved per user
- Your Gemini API key is hidden on the backend
- Background changes mood based on conversation!

---

## NOTES

- Free Render services sleep after 15 min of inactivity
  (first request after sleep takes ~30 seconds)
- To keep it awake use UptimeRobot (free) to ping your backend every 10 min
- Free PostgreSQL on Render expires after 90 days (then recreate it)


ok done