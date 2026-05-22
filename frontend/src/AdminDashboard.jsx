import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AdminDashboard() {
  const [key,        setKey]        = useState(localStorage.getItem("admin_key") || "");
  const [authed,     setAuthed]     = useState(false);
  const [users,      setUsers]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState("");
  const [keyInput,   setKeyInput]   = useState("");
  const [expanded,   setExpanded]   = useState({}); // userId -> bool
  const [userChats,  setUserChats]  = useState({}); // userId -> [conv]
  const [chatsLoading, setChatsLoading] = useState({}); // userId -> bool

  const headers = { "Content-Type": "application/json", "x-admin-key": key };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        fetch(`${API}/admin/users`, { headers }).then(r => r.json()),
        fetch(`${API}/admin/stats`, { headers }).then(r => r.json()),
      ]);
      if (u.error || s.error) { setAuthed(false); setMsg("Wrong admin key!"); }
      else { setUsers(u); setStats(s); setAuthed(true); }
    } catch { setMsg("Connection error"); }
    setLoading(false);
  }, [key]);

  const login = async () => {
    localStorage.setItem("admin_key", keyInput);
    setKey(keyInput);
  };

  useEffect(() => {
    if (key) fetchData();
  }, [key, fetchData]);

  // fetch individual user's conversations
  const fetchUserChats = useCallback(async (userId) => {
    setChatsLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const convs = await fetch(`${API}/admin/users/${userId}/conversations`, { headers }).then(r => r.json());
      setUserChats(prev => ({ ...prev, [userId]: Array.isArray(convs) ? convs : [] }));
    } catch {
      setUserChats(prev => ({ ...prev, [userId]: [] }));
    }
    setChatsLoading(prev => ({ ...prev, [userId]: false }));
  }, [key]);

  const toggleExpand = (userId) => {
    const isOpen = expanded[userId];
    setExpanded(prev => ({ ...prev, [userId]: !isOpen }));
    if (!isOpen && !userChats[userId]) {
      fetchUserChats(userId);
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}" and ALL their data permanently?`)) return;
    await fetch(`${API}/admin/users/${id}`, { method: "DELETE", headers });
    setMsg(`✅ Deleted user "${username}"`);
    fetchData();
  };

  const deleteChats = async (id, username) => {
    if (!window.confirm(`Delete ALL chats for "${username}"? User account stays.`)) return;
    await fetch(`${API}/admin/users/${id}/chats`, { method: "DELETE", headers });
    setMsg(`✅ Cleared chats for "${username}"`);
    setUserChats(prev => ({ ...prev, [id]: [] }));
    fetchData();
  };

  const deleteConv = async (userId, convId, convTitle) => {
    if (!window.confirm(`Delete conversation "${convTitle}"?`)) return;
    await fetch(`${API}/admin/conversations/${convId}`, { method: "DELETE", headers });
    setMsg(`✅ Deleted conversation "${convTitle}"`);
    setUserChats(prev => ({
      ...prev,
      [userId]: (prev[userId] || []).filter(c => c.id !== convId)
    }));
    // update msg count in users list
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, conv_count: Math.max(0, u.conv_count - 1) }
      : u
    ));
  };

  const s = {
    page:    { minHeight: "100dvh", background: "#07070f", color: "#e8e8f0", fontFamily: "DM Sans, sans-serif", padding: "2rem" },
    title:   { fontFamily: "Syne, sans-serif", fontSize: "2rem", fontWeight: 800, letterSpacing: "0.1em", background: "linear-gradient(135deg,#fff,#7c6aff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "2rem" },
    card:    { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem" },
    stat:    { display: "inline-block", background: "rgba(124,106,255,0.15)", border: "1px solid rgba(124,106,255,0.3)", borderRadius: "10px", padding: "0.8rem 1.5rem", marginRight: "1rem", marginBottom: "0.5rem", textAlign: "center" },
    statNum: { fontSize: "1.8rem", fontWeight: 700, color: "#c084fc", display: "block" },
    statLbl: { fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" },
    row:     { display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
    btn:     { padding: "0.4rem 0.9rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 },
    input:   { padding: "0.8rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontFamily: "DM Sans,sans-serif", fontSize: "0.9rem", outline: "none", width: "100%", marginBottom: "0.8rem" },
    loginBtn:{ padding: "0.85rem", background: "linear-gradient(135deg,#7c6aff,#c084fc)", border: "none", borderRadius: "10px", color: "#fff", fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", width: "100%" },
  };

  if (!authed) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(380px,90vw)" }}>
        <div style={s.title}>AURA Admin</div>
        <div style={s.card}>
          <input style={s.input} type="password" placeholder="Admin Key" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
          {msg && <div style={{ color: "#ff6b8a", fontSize: "0.82rem", marginBottom: "0.8rem" }}>{msg}</div>}
          <button style={s.loginBtn} onClick={login}>{loading ? "Checking..." : "Enter Admin →"}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div style={s.title}>AURA Admin</div>
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <button style={{ ...s.btn, background: "rgba(255,255,255,0.08)", color: "#fff" }} onClick={fetchData}>↻ Refresh</button>
            <button style={{ ...s.btn, background: "rgba(255,80,80,0.2)", color: "#ff6b8a" }} onClick={() => { localStorage.removeItem("admin_key"); setAuthed(false); setKey(""); }}>Logout</button>
          </div>
        </div>

        {msg && (
          <div style={{ background: "rgba(124,106,255,0.1)", border: "1px solid rgba(124,106,255,0.3)", borderRadius: "10px", padding: "0.8rem 1rem", marginBottom: "1.5rem", fontSize: "0.88rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{msg}</span>
            <span onClick={() => setMsg("")} style={{ cursor: "pointer", opacity: 0.5, fontSize: "1rem" }}>×</span>
          </div>
        )}

        {/* STATS */}
        {stats && (
          <div style={s.card}>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Database Overview</div>
            {[
              { label: "DB Size",       val: stats.db_size },
              { label: "Users",         val: stats.users },
              { label: "Conversations", val: stats.conversations },
              { label: "Messages",      val: stats.messages },
            ].map(item => (
              <div key={item.label} style={s.stat}>
                <span style={s.statNum}>{item.val}</span>
                <span style={s.statLbl}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* USERS */}
        <div style={s.card}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Users ({users.length})
          </div>
          {loading && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.88rem" }}>Loading...</div>}
          {users.map(u => (
            <div key={u.id}>
              {/* USER ROW */}
              <div style={s.row}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#7c6aff,#c084fc)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: "0.75rem", color: "#fff", flexShrink: 0 }}>
                  {u.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.username}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                    {u.conv_count} chats · {u.msg_count} messages · joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                {/* expand chats button */}
                <button
                  style={{ ...s.btn, background: expanded[u.id] ? "rgba(124,106,255,0.25)" : "rgba(124,106,255,0.1)", color: "#a78bfa", minWidth: "90px" }}
                  onClick={() => toggleExpand(u.id)}
                >
                  {expanded[u.id] ? "▲ Chats" : "▼ Chats"}
                </button>
                <button
                  style={{ ...s.btn, background: "rgba(255,140,0,0.15)", color: "#ffaa44" }}
                  onClick={() => deleteChats(u.id, u.username)}
                  title="Delete all chats, keep account"
                >
                  Clear All
                </button>
                <button
                  style={{ ...s.btn, background: "rgba(255,60,60,0.15)", color: "#ff6b6b" }}
                  onClick={() => deleteUser(u.id, u.username)}
                  title="Delete user and all their data"
                >
                  Delete User
                </button>
              </div>

              {/* CONVERSATIONS PANEL */}
              {expanded[u.id] && (
                <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: "10px", margin: "0 0 0.5rem 2.5rem", padding: "0.5rem 0.75rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {chatsLoading[u.id] && (
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.82rem", padding: "0.5rem 0" }}>Loading chats...</div>
                  )}
                  {!chatsLoading[u.id] && (userChats[u.id] || []).length === 0 && (
                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.82rem", padding: "0.5rem 0" }}>No conversations</div>
                  )}
                  {(userChats[u.id] || []).map(conv => (
                    <div key={conv.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: "0.85rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(255,255,255,0.7)" }}>
                        💬 {conv.title}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                        {conv.msg_count != null ? `${conv.msg_count} msgs` : ""}
                        {conv.updated_at ? ` · ${new Date(conv.updated_at).toLocaleDateString()}` : ""}
                      </span>
                      <button
                        style={{ ...s.btn, background: "rgba(255,60,60,0.12)", color: "#ff6b6b", padding: "0.3rem 0.7rem", flexShrink: 0 }}
                        onClick={() => deleteConv(u.id, conv.id, conv.title)}
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
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.88rem" }}>No users yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
