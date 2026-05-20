import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── MOOD CONFIG ──
const MOODS = {
  default:  { colors: ["#1a0533","#001a3a","#0d1a00"], border: "#7c6aff", emoji: "✨" },
  love:     { colors: ["#3a0020","#1a0015","#2a001a"], border: "#ff69b4", emoji: "💕" },
  space:    { colors: ["#000510","#050020","#001020"], border: "#4fc3f7", emoji: "⭐" },
  nature:   { colors: ["#001a00","#0a2000","#001500"], border: "#4caf50", emoji: "🍃" },
  ocean:    { colors: ["#001a2a","#00102a","#001520"], border: "#0288d1", emoji: "🌊" },
  fire:     { colors: ["#2a0500","#1a0a00","#200800"], border: "#ff6d00", emoji: "🔥" },
  mystery:  { colors: ["#0d0020","#100015","#050010"], border: "#9c27b0", emoji: "🔮" },
  happy:    { colors: ["#1a1500","#201a00","#151000"], border: "#ffd600", emoji: "🌟" },
  sad:      { colors: ["#000a1a","#00051a","#000510"], border: "#5c6bc0", emoji: "🌧️" },
  tech:     { colors: ["#001a10","#00100a","#001505"], border: "#00e676", emoji: "💻" },
  food:     { colors: ["#1a0a00","#150800","#200d00"], border: "#ff8f00", emoji: "🍕" },
  music:    { colors: ["#1a001a","#150015","#100010"], border: "#e040fb", emoji: "🎵" },
};

// ── API HELPER ──
async function apiFetch(path, opts = {}, token) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

export default function App() {
  const [token, setToken]               = useState(() => localStorage.getItem("aura_token"));
  const [username, setUsername]         = useState(() => localStorage.getItem("aura_user"));
  const [authMode, setAuthMode]         = useState("login");
  const [authForm, setAuthForm]         = useState({ username: "", password: "" });
  const [authError, setAuthError]       = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]     = useState(null);
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [mood, setMood]                 = useState("default");
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const particlesRef = useRef(null);
  const particleTimer = useRef(null);

  const currentMood = MOODS[mood] || MOODS.default;

  // ── PARTICLES ──
  const spawnParticle = useCallback(() => {
    if (!particlesRef.current) return;
    const p = document.createElement("div");
    p.style.cssText = `
      position:absolute; bottom:-60px; user-select:none; pointer-events:none;
      font-size:${Math.random()*1.2+0.7}rem;
      left:${Math.random()*100}%;
      animation: floatUp ${Math.random()*4+5}s ${Math.random()*2}s linear forwards;
      opacity:0;
    `;
    p.textContent = currentMood.emoji;
    particlesRef.current.appendChild(p);
    setTimeout(() => p.remove(), 9000);
  }, [currentMood.emoji]);

  useEffect(() => {
    clearInterval(particleTimer.current);
    particleTimer.current = setInterval(spawnParticle, 700);
    return () => clearInterval(particleTimer.current);
  }, [spawnParticle]);

  // ── SCROLL ──
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ── LOAD CONVERSATIONS ──
  useEffect(() => {
    if (!token) return;
    apiFetch("/conversations", {}, token)
      .then(setConversations)
      .catch(() => {});
  }, [token]);

  // ── LOAD MESSAGES ──
  useEffect(() => {
    if (!activeConv || !token) return;
    apiFetch(`/conversations/${activeConv.id}/messages`, {}, token)
      .then(msgs => {
        setMessages(msgs);
        if (msgs.length > 0) {
          const last = msgs.filter(m => m.role === "assistant").pop();
          if (last?.mood) setMood(last.mood);
        }
      })
      .catch(() => {});
  }, [activeConv, token]);

  // ── AUTH ──
  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    try {
      const data = await apiFetch(`/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      localStorage.setItem("aura_token", data.token);
      localStorage.setItem("aura_user", data.username);
      setToken(data.token);
      setUsername(data.username);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_user");
    setToken(null); setUsername(null);
    setConversations([]); setActiveConv(null); setMessages([]);
  }

  // ── NEW CHAT ──
  async function newChat() {
    const conv = await apiFetch("/conversations", { method: "POST", body: JSON.stringify({ title: "New Chat" }) }, token);
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
    setMood("default");
  }

  // ── SEND ──
  async function send() {
    if (!input.trim() || loading || !activeConv) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text, id: Date.now() }]);
    setLoading(true);
    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, conversationId: activeConv.id }),
      }, token);
      setMood(data.mood || "default");
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, mood: data.mood, mood_label: data.moodLabel, id: Date.now() + 1 }]);
      // refresh sidebar titles
      apiFetch("/conversations", {}, token).then(setConversations);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Something went wrong.", id: Date.now() + 1 }]);
    }
    setLoading(false);
  }

  // ── DELETE CONV ──
  async function deleteConv(id, e) {
    e.stopPropagation();
    await apiFetch(`/conversations/${id}`, { method: "DELETE" }, token);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConv?.id === id) { setActiveConv(null); setMessages([]); }
  }

  // ── AUTH SCREEN ──
  if (!token) return (
    <div style={{ position: "relative", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d1a" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 30% 40%, #1a0533 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, #001a3a 0%, transparent 55%), #0d0d1a", animation: "bgPulse 8s ease-in-out infinite alternate" }} />
      <div style={{ position: "relative", zIndex: 10, width: "min(400px, 90vw)", animation: "fadeUp 0.5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "2.2rem", letterSpacing: "0.15em", background: "linear-gradient(135deg, #fff 30%, #7c6aff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AURA</div>
          <div style={{ color: "var(--sub)", fontSize: "0.8rem", letterSpacing: "0.3em", marginTop: "0.2rem" }}>AMBIENT AI</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "20px", padding: "2rem", backdropFilter: "blur(16px)" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{ flex: 1, padding: "0.6rem", borderRadius: "10px", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.85rem", background: authMode === m ? "linear-gradient(135deg, #7c6aff, #c084fc)" : "rgba(255,255,255,0.05)", color: "#fff", transition: "all 0.2s" }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <input value={authForm.username} onChange={e => setAuthForm(p => ({ ...p, username: e.target.value }))} placeholder="Username" style={{ padding: "0.8rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", outline: "none" }} />
            <input type="password" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} placeholder="Password" style={{ padding: "0.8rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", outline: "none" }} />
            {authError && <div style={{ color: "#ff6b6b", fontSize: "0.82rem", textAlign: "center" }}>{authError}</div>}
            <button type="submit" style={{ padding: "0.85rem", background: "linear-gradient(135deg, #7c6aff, #c084fc)", border: "none", borderRadius: "10px", color: "#fff", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", marginTop: "0.3rem" }}>
              {authMode === "login" ? "Enter AURA →" : "Create Account →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── MAIN APP ──
  return (
    <div style={{ position: "relative", height: "100vh", display: "flex", overflow: "hidden" }}>

      {/* BG */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: `radial-gradient(ellipse at 20% 50%, ${currentMood.colors[0]} 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${currentMood.colors[1]} 0%, transparent 60%), radial-gradient(ellipse at 50% 80%, ${currentMood.colors[2]} 0%, transparent 60%), #0d0d1a`, transition: "background 2.5s ease", animation: "bgPulse 8s ease-in-out infinite alternate" }} />

      {/* BORDER GLOW */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", boxShadow: `inset 0 0 80px ${currentMood.border}12, 0 0 0 1.5px ${currentMood.border}40`, transition: "box-shadow 2.5s ease" }} />

      {/* PARTICLES */}
      <div ref={particlesRef} style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none", overflow: "hidden" }} />

      {/* SIDEBAR */}
      <div style={{ position: "relative", zIndex: 10, width: sidebarOpen ? "260px" : "0", minWidth: sidebarOpen ? "260px" : "0", transition: "all 0.3s ease", overflow: "hidden", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.2rem 1rem", display: "flex", flexDirection: "column", height: "100%" }}>
          {/* logo */}
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "0.15em", background: "linear-gradient(135deg, #fff 30%, #7c6aff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1.2rem", paddingLeft: "0.3rem" }}>AURA</div>

          {/* new chat */}
          <button onClick={newChat} style={{ width: "100%", padding: "0.7rem", background: "linear-gradient(135deg, #7c6aff22, #c084fc22)", border: "1px solid #7c6aff44", borderRadius: "10px", color: "#fff", fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", marginBottom: "1rem", letterSpacing: "0.05em" }}>
            + New Chat
          </button>

          {/* conversations */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {conversations.map(c => (
              <div key={c.id} onClick={() => setActiveConv(c)} style={{ padding: "0.65rem 0.8rem", borderRadius: "8px", cursor: "pointer", background: activeConv?.id === c.id ? "rgba(124,106,255,0.2)" : "transparent", border: activeConv?.id === c.id ? "1px solid rgba(124,106,255,0.3)" : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: activeConv?.id === c.id ? "#fff" : "var(--sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>💬 {c.title}</span>
                <span onClick={e => deleteConv(c.id, e)} style={{ color: "var(--sub)", fontSize: "0.9rem", opacity: 0.5, flexShrink: 0, lineHeight: 1 }}>×</span>
              </div>
            ))}
            {conversations.length === 0 && <div style={{ color: "var(--sub)", fontSize: "0.78rem", textAlign: "center", marginTop: "1rem", opacity: 0.6 }}>No conversations yet</div>}
          </div>

          {/* user */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.8rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #7c6aff, #c084fc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontFamily: "Syne, sans-serif", fontWeight: 700 }}>{username?.[0]?.toUpperCase()}</div>
              <span style={{ fontSize: "0.82rem", color: "var(--sub)" }}>{username}</span>
            </div>
            <button onClick={logout} style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "0.75rem", opacity: 0.7 }}>out</button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>

        {/* HEADER */}
        <div style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}>☰</button>
          <div style={{ flex: 1, fontFamily: "Syne, sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "var(--sub)" }}>{activeConv?.title || "AURA — Ambient AI"}</div>
          {mood !== "default" && <div style={{ fontSize: "0.72rem", color: currentMood.border, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>✦ {mood} mode</div>}
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4fffb0", boxShadow: "0 0 8px #4fffb0", animation: "pulse 2s ease-in-out infinite" }} />
        </div>

        {/* CHAT */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem", maxWidth: "780px", width: "100%", margin: "0 auto", alignSelf: "center", boxSizing: "border-box" }}>

          {/* welcome */}
          {!activeConv && (
            <div style={{ margin: "auto", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 700, background: "linear-gradient(135deg, #fff 40%, #7c6aff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.5rem" }}>What's on your mind?</div>
              <div style={{ color: "var(--sub)", fontSize: "0.9rem" }}>Start a new chat — I'll set the mood ✦</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "center", marginTop: "1.5rem" }}>
                {["Tell me about love 💕","Explain the universe 🌌","Something about nature 🌿","Motivate me 🔥","Talk about the ocean 🌊","Tell me a mystery 🔮"].map(chip => (
                  <div key={chip} onClick={async () => { await newChat(); }} style={{ padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "999px", fontSize: "0.82rem", color: "var(--sub)", cursor: "pointer", backdropFilter: "blur(8px)", background: "rgba(255,255,255,0.03)", transition: "all 0.2s" }}>{chip}</div>
                ))}
              </div>
            </div>
          )}

          {activeConv && messages.length === 0 && !loading && (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--sub)", fontSize: "0.9rem", animation: "fadeIn 0.4s ease" }}>Ask me anything ✦</div>
          )}

          {/* messages */}
          {messages.map((m, i) => (
            <div key={m.id || i} style={{ display: "flex", gap: "0.8rem", flexDirection: m.role === "user" ? "row-reverse" : "row", animation: "fadeUp 0.4s ease" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m.role === "ai" || m.role === "assistant" ? "0.7rem" : "1rem", fontFamily: "Syne, sans-serif", fontWeight: 800, letterSpacing: "0.05em", color: "#fff", background: m.role === "user" ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, #7c6aff, #c084fc)`, boxShadow: m.role !== "user" ? "0 0 12px rgba(124,106,255,0.4)" : "none" }}>
                {m.role === "user" ? "👤" : "AU"}
              </div>
              <div style={{ maxWidth: "72%" }}>
                <div style={{ padding: "0.9rem 1.2rem", borderRadius: m.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px", lineHeight: 1.65, fontSize: "0.92rem", background: m.role === "user" ? "rgba(124,106,255,0.18)" : "rgba(255,255,255,0.05)", border: m.role === "user" ? "1px solid rgba(124,106,255,0.3)" : "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
                {m.mood_label && <div style={{ fontSize: "0.7rem", color: "var(--sub)", marginTop: "0.35rem", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: "0.3rem" }}>✦ {m.mood_label}</div>}
              </div>
            </div>
          ))}

          {/* thinking */}
          {loading && (
            <div style={{ display: "flex", gap: "0.8rem", animation: "fadeUp 0.3s ease" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, #7c6aff, #c084fc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontFamily: "Syne, sans-serif", fontWeight: 800, color: "#fff", boxShadow: "0 0 12px rgba(124,106,255,0.4)" }}>AU</div>
              <div style={{ padding: "0.9rem 1.2rem", borderRadius: "4px 18px 18px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", display: "flex", gap: "5px", alignItems: "center" }}>
                {[0,150,300].map(d => <span key={d} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#7c6aff", display: "block", animation: `bounce 1.2s ${d}ms ease-in-out infinite` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div style={{ padding: "1rem 1.5rem 1.5rem", maxWidth: "780px", width: "100%", margin: "0 auto", alignSelf: "center", boxSizing: "border-box" }}>
          {!activeConv ? (
            <button onClick={newChat} style={{ width: "100%", padding: "1rem", background: "linear-gradient(135deg, #7c6aff, #c084fc)", border: "none", borderRadius: "14px", color: "#fff", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer", letterSpacing: "0.05em" }}>+ Start New Chat</button>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.8rem", background: "rgba(255,255,255,0.04)", border: `1px solid ${loading ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.1)"}`, borderRadius: "16px", padding: "0.8rem 1rem", backdropFilter: "blur(16px)", transition: "all 0.3s", boxShadow: input ? `0 0 20px ${currentMood.border}25` : "none" }}>
                <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything..." rows={1} style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontFamily: "DM Sans, sans-serif", fontSize: "0.95rem", resize: "none", maxHeight: "120px", lineHeight: 1.5 }} />
                <button onClick={send} disabled={loading || !input.trim()} style={{ width: "38px", height: "38px", borderRadius: "10px", background: input.trim() ? "linear-gradient(135deg, #7c6aff, #c084fc)" : "rgba(255,255,255,0.07)", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                  <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "#fff" }}><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                </button>
              </div>
              <div style={{ textAlign: "center", color: "var(--sub)", fontSize: "0.72rem", marginTop: "0.6rem", letterSpacing: "0.04em" }}>AURA changes its mood based on your question ✦</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
