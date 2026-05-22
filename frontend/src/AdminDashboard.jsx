import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AdminDashboard() {
  const [key,     setKey]     = useState(localStorage.getItem("admin_key") || "");
  const [authed,  setAuthed]  = useState(false);
  const [users,   setUsers]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");
  const [keyInput, setKeyInput] = useState("");

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
    fetchData();
  };

  const s = { // styles
    page:    { minHeight: "100vh", background: "#07070f", color: "#e8e8f0", fontFamily: "DM Sans, sans-serif", padding: "2rem" },
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

        {msg && <div style={{ background: "rgba(124,106,255,0.1)", border: "1px solid rgba(124,106,255,0.3)", borderRadius: "10px", padding: "0.8rem 1rem", marginBottom: "1.5rem", fontSize: "0.88rem" }}>{msg}</div>}

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
            <div key={u.id} style={s.row}>
              {/* avatar */}
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#7c6aff,#c084fc)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: "0.75rem", color: "#fff", flexShrink: 0 }}>
                {u.username[0].toUpperCase()}
              </div>
              {/* info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.username}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                  {u.conv_count} chats · {u.msg_count} messages · joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              {/* actions */}
              <button
                style={{ ...s.btn, background: "rgba(255,140,0,0.15)", color: "#ffaa44" }}
                onClick={() => deleteChats(u.id, u.username)}
                title="Delete chats only, keep account"
              >
                Clear Chats
              </button>
              <button
                style={{ ...s.btn, background: "rgba(255,60,60,0.15)", color: "#ff6b6b" }}
                onClick={() => deleteUser(u.id, u.username)}
                title="Delete user and all their data"
              >
                Delete User
              </button>
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
