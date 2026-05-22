import { useState, useEffect, useRef, useCallback } from "react";
import ElectricBorder from "./ElectricBorder";
import AdminDashboard from "./AdminDashboard";
import PeekingCreature from "./PeekingCreature";
import MagicRings from "./MagicRings";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const DEFAULT_MOOD = {
  moodLabel: '',
  emoji: '✨',
  bgColor1: '#0d0d2b',
  bgColor2: '#1a1040',
  bgColor3: '#0d1a2b',
  borderColor: '#7c6aff',
  glowRGB: '124,106,255'
};

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
  const [token, setToken]       = useState(() => localStorage.getItem("aura_token"));
  const [username, setUsername] = useState(() => localStorage.getItem("aura_user"));
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [moodData, setMoodData] = useState(DEFAULT_MOOD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const particlesRef = useRef(null);
  const particleTimer = useRef(null);

  const m = moodData || DEFAULT_MOOD;

  // particles
  const spawnParticle = useCallback(() => {
    if (!particlesRef.current) return;
    const p = document.createElement("div");
    const size = Math.random() * 4 + 3;
    const dur = Math.random() * 5 + 6;
    p.style.cssText = `
      position:absolute;bottom:-60px;pointer-events:none;user-select:none;
      font-size:${size}rem;
      left:${Math.random() * 95}%;
      animation:floatUp ${dur}s ${Math.random() * 2}s linear forwards;
      opacity:0;filter:drop-shadow(0 0 6px rgba(${m.glowRGB},0.8));
    `;
    p.textContent = moodData?.emoji || "✨";
    particlesRef.current.appendChild(p);
    setTimeout(() => p.remove(), (dur + 3) * 1000);
  }, [m.glowRGB, moodData]);

  useEffect(() => {
    clearInterval(particleTimer.current);
    particleTimer.current = setInterval(spawnParticle, 800);
    return () => clearInterval(particleTimer.current);
  }, [spawnParticle]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/conversations", {}, token).then(setConversations).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!activeConv || !token) return;
    apiFetch(`/conversations/${activeConv.id}/messages`, {}, token)
      .then(msgs => {
        setMessages(msgs);
        const last = msgs.filter(msg => msg.role === "assistant").pop();
        if (last?.mood) {
          try {
            const parsed = JSON.parse(last.mood);
            if (parsed && typeof parsed === "object") setMoodData(parsed);
          } catch(e) {}
        }
      }).catch(() => {});
  }, [activeConv, token]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const data = await apiFetch(`/${authMode}`, { method: "POST", body: JSON.stringify(authForm) });
      localStorage.setItem("aura_token", data.token);
      localStorage.setItem("aura_user", data.username);
      setToken(data.token);
      setUsername(data.username);
    } catch (err) { setAuthError(err.message); }
    setAuthLoading(false);
  }

  function logout() {
    localStorage.removeItem("aura_token");
    localStorage.removeItem("aura_user");
    setToken(null); setUsername(null);
    setConversations([]); setActiveConv(null); setMessages([]);
  }

  async function newChat() {
    try {
      const conv = await apiFetch("/conversations", { method: "POST", body: JSON.stringify({ title: "New Chat" }) }, token);
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
      setMessages([]);
      setMoodData(DEFAULT_MOOD);
      setSidebarOpen(false);
      return conv;
    } catch(e) { return null; }
  }

  async function send() {
    if (!input.trim() || loading) return;
    let conv = activeConv;
    if (!conv) {
      conv = await newChat();
      if (!conv) return;
    }
    const text = input.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages(prev => [...prev, { role: "user", content: text, id: Date.now() }]);
    setLoading(true);
    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, conversationId: conv.id }),
      }, token);
      if (data.moodData) setMoodData(data.moodData);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, mood: data.mood, mood_label: data.moodData?.moodLabel, id: Date.now() + 1 }]);
      apiFetch("/conversations", {}, token).then(setConversations);
    } catch(e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + e.message, id: Date.now() + 1 }]);
    }
    setLoading(false);
  }

  async function deleteConv(id, e) {
    e.stopPropagation();
    await apiFetch(`/conversations/${id}`, { method: "DELETE" }, token);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConv?.id === id) { setActiveConv(null); setMessages([]); }
  }

  // ADMIN ROUTE
  if (window.location.pathname === "/admin") return <AdminDashboard />;

  // AUTH SCREEN
  if (!token) return (
    <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#07070f", position:"relative", overflowX:"hidden", overflowY:"auto", padding:"1rem 0" }}>
      <div style={{ position:"fixed", inset:0, background:"#07070f" }} />
      {/* MAGIC RINGS BACKGROUND */}
      <div style={{ position:"fixed", inset:0, zIndex:1 }}>
        <MagicRings color="#7c6aff" colorTwo="#c084fc" ringCount={5} speed={0.8} opacity={0.85} followMouse={true} mouseInfluence={0.1} parallax={0.03} clickBurst={true} blur={0} noiseAmount={0.06} baseRadius={0.2} radiusStep={0.08} />
      </div>
      <div style={{ position:"fixed", inset:0, zIndex:2, boxShadow:"inset 0 0 120px rgba(124,106,255,0.08)", pointerEvents:"none" }} />
      <div style={{ position:"relative", zIndex:10, width:"min(400px,92vw)", animation:"fadeUp 0.5s ease", margin:"auto" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:"2.5rem", letterSpacing:"0.2em", background:"linear-gradient(135deg,#fff 20%,#7c6aff 60%,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AURA</div>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.7rem", letterSpacing:"0.4em", marginTop:"0.3rem" }}>AMBIENT AI</div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"24px", padding:"2rem", backdropFilter:"blur(20px)" }}>
          <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", background:"rgba(0,0,0,0.2)", borderRadius:"12px", padding:"0.3rem" }}>
            {["login","register"].map(mode => (
              <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(""); }} style={{ flex:1, padding:"0.6rem", borderRadius:"9px", border:"none", cursor:"pointer", fontFamily:"Syne,sans-serif", fontWeight:600, fontSize:"0.82rem", background: authMode===mode ? "linear-gradient(135deg,#7c6aff,#c084fc)" : "transparent", color: authMode===mode ? "#fff" : "rgba(255,255,255,0.4)", transition:"all 0.2s", letterSpacing:"0.05em" }}>
                {mode === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} style={{ display:"flex", flexDirection:"column", gap:"0.8rem" }}>
            {["username","password"].map(field => (
              <input key={field} type={field==="password"?"password":"text"} placeholder={field.charAt(0).toUpperCase()+field.slice(1)} value={authForm[field]} onChange={e => setAuthForm(p => ({...p,[field]:e.target.value}))} style={{ padding:"0.85rem 1rem", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:"12px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:"0.9rem", outline:"none", transition:"border-color 0.2s" }} onFocus={e => e.target.style.borderColor="rgba(124,106,255,0.6)"} onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.09)"} />
            ))}
            {authError && <div style={{ color:"#ff6b8a", fontSize:"0.82rem", textAlign:"center", padding:"0.4rem", background:"rgba(255,107,138,0.1)", borderRadius:"8px" }}>{authError}</div>}
            <button type="submit" disabled={authLoading} style={{ padding:"0.9rem", background: authLoading ? "rgba(124,106,255,0.5)" : "linear-gradient(135deg,#7c6aff,#c084fc)", border:"none", borderRadius:"12px", color:"#fff", fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"0.95rem", cursor: authLoading ? "not-allowed" : "pointer", marginTop:"0.3rem", letterSpacing:"0.05em", boxShadow:"0 4px 20px rgba(124,106,255,0.4)", transition:"all 0.2s" }}>
              {authLoading ? "Please wait..." : authMode==="login" ? "Enter AURA →" : "Create Account →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // MAIN APP
  return (
    <div style={{ height:"100dvh", display:"flex", position:"relative", overflow:"hidden", background:"#07070f" }}>

      {/* ANIMATED BG */}
      <div style={{ position:"fixed", inset:0, zIndex:0,
        background:`radial-gradient(ellipse at 15% 50%, ${m.bgColor1} 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, ${m.bgColor2} 0%, transparent 55%), radial-gradient(ellipse at 50% 85%, ${m.bgColor3} 0%, transparent 55%), #07070f`,
        transition:"background 3s ease", animation:"bgPulse 10s ease-in-out infinite alternate"
      }} />

      {/* BORDER GLOW */}
      <div style={{ position:"fixed", inset:0, zIndex:1, pointerEvents:"none",
        boxShadow:`inset 0 0 100px rgba(${m.glowRGB},0.08), inset 0 0 1px rgba(${m.glowRGB},0.5)`,
        border:`1px solid rgba(${m.glowRGB},0.2)`,
        transition:"all 3s ease"
      }} />

      {/* CORNER ACCENTS */}
      {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
        <div key={i} style={{ position:"fixed", zIndex:2, pointerEvents:"none", width:"120px", height:"120px", ...pos,
          background:`radial-gradient(circle at ${i<2?(i===0?"0% 0%":"100% 0%"):(i===2?"0% 100%":"100% 100%")}, rgba(${m.glowRGB},0.2) 0%, transparent 70%)`,
          transition:"all 3s ease"
        }} />
      ))}

      {/* PARTICLES */}
      <div ref={particlesRef} style={{ position:"fixed", inset:0, zIndex:2, pointerEvents:"none", overflow:"hidden" }} />

      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{ position:"fixed", inset:0, zIndex:20, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }} />}

      {/* SIDEBAR */}
      <div style={{ position:"fixed", top:0, left:0, height:"100%", zIndex:30,
        width: sidebarOpen ? "min(280px, 80vw)" : "0",
        transition:"width 0.3s cubic-bezier(.4,0,.2,1)",
        overflow:"hidden",
        background:"rgba(7,7,15,0.95)",
        backdropFilter:"blur(24px)",
        borderRight:`1px solid rgba(${m.glowRGB},0.15)`,
        boxShadow: sidebarOpen ? `4px 0 40px rgba(0,0,0,0.5)` : "none"
      }}>
        <div style={{ width:"min(280px,80vw)", height:"100%", display:"flex", flexDirection:"column", padding:"1.2rem 1rem" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.2rem" }}>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:"1.2rem", letterSpacing:"0.15em", background:`linear-gradient(135deg,#fff,${m.borderColor})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AURA</div>
            <button onClick={()=>setSidebarOpen(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:"1.3rem", lineHeight:1 }}>×</button>
          </div>
          <button onClick={newChat} style={{ width:"100%", padding:"0.75rem", background:`linear-gradient(135deg, rgba(${m.glowRGB},0.2), rgba(${m.glowRGB},0.08))`, border:`1px solid rgba(${m.glowRGB},0.3)`, borderRadius:"12px", color:"#fff", fontFamily:"Syne,sans-serif", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", marginBottom:"1rem", letterSpacing:"0.05em", transition:"all 0.2s" }}>
            + New Chat
          </button>
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"0.25rem" }}>
            {conversations.map(c => (
              <div key={c.id} onClick={()=>{ setActiveConv(c); setSidebarOpen(false); }} style={{ padding:"0.65rem 0.75rem", borderRadius:"10px", cursor:"pointer", background: activeConv?.id===c.id ? `rgba(${m.glowRGB},0.18)` : "transparent", border: activeConv?.id===c.id ? `1px solid rgba(${m.glowRGB},0.3)` : "1px solid transparent", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem", transition:"all 0.15s" }}>
                <span style={{ fontSize:"0.78rem", color: activeConv?.id===c.id ? "#fff" : "rgba(255,255,255,0.45)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>💬 {c.title}</span>
                <span onClick={e=>deleteConv(c.id,e)} style={{ color:"rgba(255,255,255,0.25)", fontSize:"1rem", flexShrink:0, lineHeight:1, cursor:"pointer" }}>×</span>
              </div>
            ))}
            {conversations.length===0 && <div style={{ color:"rgba(255,255,255,0.2)", fontSize:"0.75rem", textAlign:"center", marginTop:"1rem" }}>No conversations yet</div>}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:"0.8rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
              <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:`linear-gradient(135deg,#7c6aff,#c084fc)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:"0.75rem", color:"#fff" }}>{username?.[0]?.toUpperCase()}</div>
              <span style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.5)" }}>{username}</span>
            </div>
            <button onClick={logout} style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"6px", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:"0.72rem", padding:"0.3rem 0.6rem" }}>out</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", zIndex:10, minWidth:0 }}>

        {/* HEADER */}
        <div style={{ padding:"0.9rem 1rem", display:"flex", alignItems:"center", gap:"0.8rem", borderBottom:"1px solid rgba(255,255,255,0.05)", backdropFilter:"blur(10px)", background:"rgba(7,7,15,0.6)", flexShrink:0 }}>
          <button onClick={()=>setSidebarOpen(true)} style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:"1rem", lineHeight:1, padding:"0.4rem 0.5rem", flexShrink:0 }}>☰</button>
          <div style={{ flex:1, fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"0.85rem", color:"rgba(255,255,255,0.4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeConv?.title || "AURA"}</div>
          {moodData?.moodLabel && <div style={{ fontSize:"0.68rem", color:m.borderColor, letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0, opacity:0.9 }}>✦ {moodData.moodLabel}</div>}
          <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#4fffb0", boxShadow:"0 0 8px #4fffb0", flexShrink:0, animation:"pulse 2s ease-in-out infinite" }} />
        </div>

        {/* CHAT — fully fluid width with padding on sides */}
        <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"1.2rem clamp(0.8rem, 4vw, 3rem)", display:"flex", flexDirection:"column", gap:"1rem", scrollbarWidth:"thin", scrollbarColor:"rgba(255,255,255,0.1) transparent" }}>

          {/* inner wrapper — fills width on phone/tablet, capped on laptop+ */}
          <div className="chat-container" style={{ width:"100%", maxWidth:"680px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"1rem" }}>

            {/* WELCOME */}
            {!activeConv && (
              <div style={{ margin:"auto", textAlign:"center", paddingTop:"2rem", animation:"fadeUp 0.6s ease" }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:"clamp(1.6rem,5vw,2.8rem)", fontWeight:800, background:`linear-gradient(135deg,#fff 30%,${m.borderColor})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:"0.5rem", lineHeight:1.1 }}>What's on your mind?</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.88rem", marginBottom:"1.8rem" }}>I'll set the mood for you ✦</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"0.5rem", justifyContent:"center" }}>
                  {["Tell me about love 💕","Explain the universe 🌌","Something about nature 🌿","Motivate me 🔥","Talk about the ocean 🌊","Tell me a mystery 🔮","Talk about music 🎵","Recommend food 🍕"].map(chip => (
                    <div key={chip} onClick={()=>{ setInput(chip); inputRef.current?.focus(); }} style={{ padding:"0.45rem 0.9rem", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"999px", fontSize:"0.78rem", color:"rgba(255,255,255,0.45)", cursor:"pointer", background:"rgba(255,255,255,0.02)", transition:"all 0.2s" }} onMouseEnter={e=>{ e.target.style.borderColor=m.borderColor; e.target.style.color="#fff"; }} onMouseLeave={e=>{ e.target.style.borderColor="rgba(255,255,255,0.1)"; e.target.style.color="rgba(255,255,255,0.45)"; }}>
                      {chip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeConv && messages.length===0 && !loading && (
              <div style={{ textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:"0.88rem", paddingTop:"3rem", animation:"fadeIn 0.4s ease" }}>Ask me anything ✦</div>
            )}

            {/* MESSAGES */}
            {messages.map((msg, i) => (
              <div key={msg.id||i} style={{ display:"flex", gap:"0.3rem", flexDirection: msg.role==="user" ? "row-reverse" : "row", animation:"fadeUp 0.35s ease" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize: msg.role==="user" ? "0.9rem" : "0.65rem", fontFamily:"Syne,sans-serif", fontWeight:800, color:"#fff", background: msg.role==="user" ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg,#7c6aff,#c084fc)`, boxShadow: msg.role!=="user" ? `0 0 16px rgba(124,106,255,0.5)` : "none", flexBasis:"32px" }}>
                  {msg.role==="user" ? "👤" : "AU"}
                </div>
                {/* bubble grows with available space — no fixed maxWidth */}
                <div style={{ flex: msg.role==="user" ? "0 1 auto" : "1", minWidth:0, maxWidth: msg.role==="user" ? "80%" : "100%" }}>
                  <div style={{ padding:"0.85rem 1.1rem", lineHeight:1.7, fontSize:"0.9rem", borderRadius: msg.role==="user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px", background: msg.role==="user" ? `rgba(${m.glowRGB},0.15)` : "rgba(255,255,255,0.04)", border: msg.role==="user" ? `1px solid rgba(${m.glowRGB},0.25)` : "1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", wordBreak:"break-word", whiteSpace:"pre-wrap" }}>
                    {msg.content}
                  </div>
                  {msg.mood_label && <div style={{ fontSize:"0.68rem", color:`rgba(${m.glowRGB},0.7)`, marginTop:"0.3rem", letterSpacing:"0.08em", textTransform:"uppercase", paddingLeft:"0.3rem" }}>✦ {msg.mood_label}</div>}
                </div>
              </div>
            ))}

            {/* THINKING */}
            {loading && (
              <div style={{ display:"flex", gap:"0.7rem", animation:"fadeUp 0.3s ease" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:`linear-gradient(135deg,#7c6aff,#c084fc)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", fontFamily:"Syne,sans-serif", fontWeight:800, color:"#fff", boxShadow:"0 0 16px rgba(124,106,255,0.5)", flexShrink:0 }}>AU</div>
                <div style={{ padding:"0.85rem 1.1rem", borderRadius:"4px 18px 18px 18px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", display:"flex", gap:"5px", alignItems:"center" }}>
                  {[0,150,300].map(d=><span key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:m.borderColor, display:"block", animation:`bounce 1.2s ${d}ms ease-in-out infinite`, boxShadow:`0 0 6px rgba(${m.glowRGB},0.8)` }} />)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA */}
        <div style={{ paddingTop:"0.8rem", paddingLeft:"clamp(0.8rem, 4vw, 3rem)", paddingRight:"clamp(0.8rem, 4vw, 3rem)", paddingBottom:"max(calc(env(safe-area-inset-bottom) + 0.8rem), 1.2rem)", backdropFilter:"blur(20px)", background:"rgba(7,7,15,0.7)", borderTop:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
          <div className="input-container" style={{ maxWidth:"680px", margin:"0 auto" }}>
            <ElectricBorder
              color={m.borderColor}
              speed={inputFocused ? 1.2 : 0.5}
              chaos={inputFocused ? 0.08 : 0.03}
              borderRadius={18}
              style={{ display:"block" }}
            >
              <div style={{ display:"flex", alignItems:"flex-end", gap:"0.7rem", background: inputFocused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)", borderRadius:"18px", padding:"0.75rem 0.75rem 0.75rem 1rem", transition:"all 0.3s ease" }}>
                <textarea ref={inputRef} value={input} onChange={e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }} onFocus={()=>setInputFocused(true)} onBlur={()=>setInputFocused(false)} placeholder="Ask anything..." rows={1} style={{ flex:1, background:"none", border:"none", outline:"none", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:"0.92rem", resize:"none", maxHeight:"120px", lineHeight:1.55, scrollbarWidth:"none" }} />
                <button onClick={send} disabled={loading||!input.trim()} style={{ width:"36px", height:"36px", borderRadius:"10px", background: input.trim() ? `linear-gradient(135deg,#7c6aff,#c084fc)` : "rgba(255,255,255,0.06)", border:"none", cursor: input.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s", boxShadow: input.trim() ? `0 0 16px rgba(${m.glowRGB},0.5)` : "none", transform: input.trim() ? "scale(1)" : "scale(0.95)" }}>
                  <svg viewBox="0 0 24 24" style={{ width:"15px", height:"15px", fill:"#fff" }}><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                </button>
              </div>
            </ElectricBorder>
            <div style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:"0.68rem", marginTop:"0.6rem", letterSpacing:"0.05em" }}>AURA changes mood based on your question ✦ shift+enter for new line</div>
          </div>
        </div>
      </div>
    {/* PEEKING CREATURE */}
    <PeekingCreature glowRGB={m.glowRGB} borderColor={m.borderColor} />
    </div>
  );
}
