import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AdminDashboard() {
  const [key,          setKey]          = useState(localStorage.getItem("admin_key") || "");
  const [keyInput,     setKeyInput]     = useState("");
  const [authed,       setAuthed]       = useState(false);
  const [users,        setUsers]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState("");
  const [expanded,     setExpanded]     = useState({});
  const [userConvs,    setUserConvs]    = useState({});
  const [convLoading,  setConvLoading]  = useState({});

  const h = () => ({ "Content-Type": "application/json", "x-admin-key": key });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        fetch(`${API}/admin/users`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/admin/stats`, { headers: h() }).then(r => r.json()),
      ]);
      if (u.error || s.error) { setAuthed(false); setMsg("Wrong admin key!"); }
      else { setUsers(u); setStats(s); setAuthed(true); }
    } catch { setMsg("Connection error"); }
    setLoading(false);
  }, [key]);

  useEffect(() => { if (key) fetchData(); }, [key, fetchData]);

  const login = () => {
    localStorage.setItem("admin_key", keyInput);
    setKey(keyInput);
  };

  const loadConvs = async (userId) => {
    setConvLoading(p => ({ ...p, [userId]: true }));
    try {
      const data = await fetch(`${API}/admin/users/${userId}/conversations`, { headers: h() }).then(r => r.json());
      setUserConvs(p => ({ ...p, [userId]: Array.isArray(data) ? data : [] }));
    } catch {
      setUserConvs(p => ({ ...p, [userId]: [] }));
    }
    setConvLoading(p => ({ ...p, [userId]: false }));
  };

  const toggleExpand = (userId) => {
    const opening = !expanded[userId];
    setExpanded(p => ({ ...p, [userId]: opening }));
    if (opening && !userConvs[userId]) loadConvs(userId);
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete "${name}" and ALL their data?`)) return;
    await fetch(`${API}/admin/users/${id}`, { method: "DELETE", headers: h() });
    setMsg(`✅ Deleted user "${name}"`);
    fetchData();
  };

  const clearAllChats = async (id, name) => {
    if (!window.confirm(`Delete ALL chats for "${name}"?`)) return;
    await fetch(`${API}/admin/users/${id}/chats`, { method: "DELETE", headers: h() });
    setMsg(`✅ Cleared all chats for "${name}"`);
    setUserConvs(p => ({ ...p, [id]: [] }));
    fetchData();
  };

  const deleteConv = async (userId, convId, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await fetch(`${API}/admin/conversations/${convId}`, { method: "DELETE", headers: h() });
    setMsg(`✅ Deleted "${title}"`);
    setUserConvs(p => ({ ...p, [userId]: (p[userId] || []).filter(c => c.id !== convId) }));
    setUsers(p => p.map(u => u.id === userId ? { ...u, conv_count: Math.max(0, u.conv_count - 1) } : u));
  };

  const s = {
    page:     { minHeight:"100dvh", background:"#07070f", color:"#e8e8f0", fontFamily:"DM Sans,sans-serif", padding:"2rem" },
    title:    { fontFamily:"Syne,sans-serif", fontSize:"2rem", fontWeight:800, letterSpacing:"0.1em", background:"linear-gradient(135deg,#fff,#7c6aff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:"2rem" },
    card:     { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", padding:"1.5rem", marginBottom:"1.5rem" },
    stat:     { display:"inline-block", background:"rgba(124,106,255,0.15)", border:"1px solid rgba(124,106,255,0.3)", borderRadius:"10px", padding:"0.8rem 1.5rem", marginRight:"1rem", marginBottom:"0.5rem", textAlign:"center" },
    statNum:  { fontSize:"1.8rem", fontWeight:700, color:"#c084fc", display:"block" },
    statLbl:  { fontSize:"0.75rem", color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase" },
    userRow:  { display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.75rem 0", borderBottom:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" },
    convRow:  { display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.5rem 0", borderBottom:"1px solid rgba(255,255,255,0.04)" },
    btn:      { padding:"0.35rem 0.75rem", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"0.76rem", fontWeight:600, flexShrink:0 },
    input:    { padding:"0.8rem 1rem", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:"0.9rem", outline:"none", width:"100%", marginBottom:"0.8rem" },
    loginBtn: { padding:"0.85rem", background:"linear-gradient(135deg,#7c6aff,#c084fc)", border:"none", borderRadius:"10px", color:"#fff", fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"0.95rem", cursor:"pointer", width:"100%" },
  };

  if (!authed) return (
    <div style={{ ...s.page, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"min(380px,90vw)" }}>
        <div style={s.title}>AURA Admin</div>
        <div style={s.card}>
          <input style={s.input} type="password" placeholder="Admin Key" value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()} />
          {msg && <div style={{ color:"#ff6b8a", fontSize:"0.82rem", marginBottom:"0.8rem" }}>{msg}</div>}
          <button style={s.loginBtn} onClick={login}>Enter Admin →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={{ maxWidth:"960px", margin:"0 auto" }}>

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"2rem", flexWrap:"wrap", gap:"0.8rem" }}>
          <div style={s.title}>AURA Admin</div>
          <div style={{ display:"flex", gap:"0.6rem" }}>
            <button style={{ ...s.btn, background:"rgba(255,255,255,0.08)", color:"#fff", padding:"0.5rem 1rem" }} onClick={fetchData}>↻ Refresh</button>
            <button style={{ ...s.btn, background:"rgba(255,80,80,0.15)", color:"#ff6b8a", padding:"0.5rem 1rem" }} onClick={() => { localStorage.removeItem("admin_key"); setAuthed(false); setKey(""); }}>Logout</button>
          </div>
        </div>

        {/* MSG */}
        {msg && (
          <div style={{ background:"rgba(124,106,255,0.1)", border:"1px solid rgba(124,106,255,0.3)", borderRadius:"10px", padding:"0.8rem 1rem", marginBottom:"1.5rem", fontSize:"0.88rem", display:"flex", justifyContent:"space-between" }}>
            <span>{msg}</span>
            <span onClick={() => setMsg("")} style={{ cursor:"pointer", opacity:0.5 }}>×</span>
          </div>
        )}

        {/* STATS */}
        {stats && (
          <div style={s.card}>
            <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.35)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"1rem" }}>Database</div>
            {[["DB Size", stats.db_size], ["Users", stats.users], ["Conversations", stats.conversations], ["Messages", stats.messages]].map(([label, val]) => (
              <div key={label} style={s.stat}>
                <span style={s.statNum}>{val}</span>
                <span style={s.statLbl}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* USERS */}
        <div style={s.card}>
          <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.35)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"1rem" }}>
            Users ({users.length})
          </div>

          {loading && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.88rem" }}>Loading...</div>}

          {users.map(u => (
            <div key={u.id}>
              {/* USER ROW */}
              <div style={s.userRow}>
                {/* avatar */}
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"linear-gradient(135deg,#7c6aff,#c084fc)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:"0.72rem", color:"#fff", flexShrink:0 }}>
                  {u.username[0].toUpperCase()}
                </div>
                {/* info */}
                <div style={{ flex:1, minWidth:"120px" }}>
                  <div style={{ fontWeight:600, fontSize:"0.88rem" }}>{u.username}</div>
                  <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.3)" }}>
                    {u.conv_count} chats · {u.msg_count} msgs · {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                {/* actions */}
                <button style={{ ...s.btn, background: expanded[u.id] ? "rgba(124,106,255,0.3)" : "rgba(124,106,255,0.12)", color:"#a78bfa" }}
                  onClick={() => toggleExpand(u.id)}>
                  {expanded[u.id] ? "▲ Hide" : "▼ Chats"}
                </button>
                <button style={{ ...s.btn, background:"rgba(255,140,0,0.12)", color:"#ffaa44" }}
                  onClick={() => clearAllChats(u.id, u.username)}>
                  Clear All
                </button>
                <button style={{ ...s.btn, background:"rgba(255,60,60,0.12)", color:"#ff6b6b" }}
                  onClick={() => deleteUser(u.id, u.username)}>
                  Delete User
                </button>
              </div>

              {/* CONVERSATIONS PANEL */}
              {expanded[u.id] && (
                <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:"10px", margin:"0 0 0.5rem 2.8rem", padding:"0.5rem 0.8rem", border:"1px solid rgba(255,255,255,0.05)" }}>
                  {convLoading[u.id] && (
                    <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.8rem", padding:"0.5rem 0" }}>Loading conversations...</div>
                  )}
                  {!convLoading[u.id] && (userConvs[u.id] || []).length === 0 && (
                    <div style={{ color:"rgba(255,255,255,0.2)", fontSize:"0.8rem", padding:"0.5rem 0" }}>No conversations found</div>
                  )}
                  {(userConvs[u.id] || []).map(conv => (
                    <div key={conv.id} style={s.convRow}>
                      <span style={{ fontSize:"0.82rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"rgba(255,255,255,0.65)" }}>
                        💬 {conv.title || "Untitled"}
                      </span>
                      <span style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.25)", flexShrink:0 }}>
                        {conv.msg_count} msgs
                      </span>
                      <span style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.2)", flexShrink:0 }}>
                        {new Date(conv.created_at).toLocaleDateString()}
                      </span>
                      <button
                        style={{ ...s.btn, background:"rgba(255,60,60,0.15)", color:"#ff6b6b", padding:"0.25rem 0.6rem" }}
                        onClick={() => deleteConv(u.id, conv.id, conv.title || "Untitled")}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {users.length === 0 && !loading && (
            <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.88rem" }}>No users yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
