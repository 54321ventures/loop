import { useEffect, useState } from "react";
import { supabase, cloudEnabled } from "./supabase.js";
import { startSync, stopSync, onSyncChange } from "./sync.js";
import Loop from "./loop.jsx";

const FONT = "'Sora',system-ui,sans-serif";
const inp = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "13px 15px", fontSize: 16, color: "#F4F3FB", outline: "none", fontFamily: FONT, marginBottom: 10, boxSizing: "border-box" };

function SignIn() {
  const [mode, setMode] = useState("signin"), [name, setName] = useState(""), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (mode === "signup" && !name.trim()) return setErr("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Please enter a valid email.");
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true);
    const { data, error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password: pw, options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    if (mode === "signup" && !data.session) setMsg("Check your email to confirm your account, then sign in.");
  };
  const reset = async () => { if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter your email above first."); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); error ? setErr(error.message) : setMsg("Password reset email sent."); };
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "radial-gradient(1200px 600px at 50% -10%, #241B3A, #0E1020)", fontFamily: FONT, color: "#F4F3FB" }}>
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Loop 🌱</div><div style={{ color: "#AEB0C6", marginTop: 6, fontSize: 14 }}>{mode === "signin" ? "Welcome back" : "Create your account to sync across devices"}</div></div>
      {mode === "signup" && <input style={inp} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      <input style={inp} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input style={inp} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
      {err && <div style={{ color: "#FF9EA8", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: "#8BE0A8", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button disabled={busy} style={{ width: "100%", border: "none", background: "linear-gradient(135deg,#FF7A8A,#8B7CFF)", color: "#fff", borderRadius: 14, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: "#AEB0C6" }}>
        <span onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); setMsg(""); }} style={{ cursor: "pointer", textDecoration: "underline" }}>{mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}</span>
        {mode === "signin" && <><br /><span onClick={reset} style={{ cursor: "pointer", display: "inline-block", marginTop: 10, color: "#6E7191" }}>Forgot password?</span></>}
      </div>
    </form></div>;
}

export default function AuthGate() {
  const [session, setSession] = useState(undefined), [ready, setReady] = useState(!cloudEnabled), [ver, setVer] = useState(0);
  useEffect(() => onSyncChange((i) => { if (i.remoteChanged) setVer((v) => v + 1); }), []); // another device changed data → reload view
  useEffect(() => {
    if (!cloudEnabled) { startSync("local"); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const uid = session?.user?.id;
  useEffect(() => { if (!cloudEnabled || session === undefined) return; setReady(false); if (!uid) { stopSync(); return; } startSync(uid).finally(() => setReady(true)); return stopSync; }, [uid, session === undefined]);

  if (!cloudEnabled) return <Loop account={null} onLogout={null} />;
  if (session === undefined || (uid && !ready)) return <div style={{ minHeight: "100vh", background: "#0E1020", color: "#AEB0C6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>Syncing…</div>;
  if (!session) return <SignIn />;
  const u = session.user, account = { name: u.user_metadata?.name || u.email.split("@")[0], email: u.email };
  return <Loop key={uid + ":" + ver} account={account} onLogout={() => supabase.auth.signOut()} />;
}
