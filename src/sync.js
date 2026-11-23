// Local-first key/value store that mirrors window.storage's API and syncs to Supabase.
// - Reads/writes hit localStorage instantly (works offline).
// - Writes are queued and pushed to the cloud; on login/focus/online we pull and merge (newest wins).
import { supabase, cloudEnabled } from "./supabase.js";

const P = "loopkv:";            // localStorage namespace (per user id appended)
let uid = "local", listeners = new Set(), channel = null, flushing = false;
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
const rk = (k) => `${P}${uid}:${k}`;
const qk = () => `${P}${uid}:__queue`;
const readQ = () => { try { return JSON.parse(ls.get(qk()) || "{}"); } catch { return {}; } };
const writeQ = (q) => ls.set(qk(), JSON.stringify(q));
const readRec = (k) => { try { return JSON.parse(ls.get(rk(k)) || "null"); } catch { return null; } };
const emit = (info) => listeners.forEach((f) => f(info));
export const onSyncChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const syncStatus = { state: cloudEnabled ? "idle" : "local", last: null };
const setStatus = (state) => { syncStatus.state = state; if (state === "synced") syncStatus.last = Date.now(); emit({ status: state }); };

function allKeys() { const pre = rk(""); const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre) && !k.endsWith("__queue")) out.push(k.slice(pre.length)); } } catch {} return out; }

export const storage = {
  async get(k) { const r = readRec(k); return r && !r.deleted ? { key: k, value: JSON.stringify(r.value) } : null; },
  async set(k, valueStr) {
    const value = JSON.parse(valueStr), updated_at = new Date().toISOString();
    if (!ls.set(rk(k), JSON.stringify({ value, updated_at, deleted: false }))) throw new Error("Device storage full");
    const q = readQ(); q[k] = 1; writeQ(q); flush(); return { key: k };
  },
  async delete(k) {
    ls.set(rk(k), JSON.stringify({ value: null, updated_at: new Date().toISOString(), deleted: true }));
    const q = readQ(); q[k] = 1; writeQ(q); flush(); return { key: k, deleted: true };
  },
  async list() { return { keys: allKeys().filter((k) => { const r = readRec(k); return r && !r.deleted; }) }; },
};

export async function flush() {
  if (!cloudEnabled || uid === "local" || flushing || !navigator.onLine) return;
  const q = readQ(), keys = Object.keys(q); if (!keys.length) return;
  flushing = true; setStatus("syncing");
  try {
    const rows = keys.map((k) => { const r = readRec(k); return r && { user_id: uid, key: k, value: r.value, deleted: !!r.deleted, updated_at: r.updated_at }; }).filter(Boolean);
    const { error } = await supabase.from("kv").upsert(rows, { onConflict: "user_id,key" });
    if (error) throw error;
    const cur = readQ(); keys.forEach((k) => { if (readRec(k)?.updated_at === rows.find((r) => r.key === k)?.updated_at) delete cur[k]; }); writeQ(cur);
    setStatus("synced");
  } catch (e) { console.warn("sync push failed", e); setStatus("error"); }
  finally { flushing = false; }
}

export async function pull() {
  if (!cloudEnabled || uid === "local" || !navigator.onLine) return;
  setStatus("syncing");
  try {
    const { data, error } = await supabase.from("kv").select("key,value,deleted,updated_at").eq("user_id", uid);
    if (error) throw error;
    const q = readQ(); let changed = false;
    for (const row of data) {
      const mine = readRec(row.key);
      if (!mine || new Date(row.updated_at) > new Date(mine.updated_at)) { ls.set(rk(row.key), JSON.stringify({ value: row.value, updated_at: row.updated_at, deleted: row.deleted })); delete q[row.key]; changed = true; }
    }
    // local-only keys (created offline / before first login) → push up
    const remote = new Set(data.map((r) => r.key));
    allKeys().forEach((k) => { if (!remote.has(k)) q[k] = 1; });
    writeQ(q); await flush(); setStatus("synced");
    if (changed) emit({ remoteChanged: true });
  } catch (e) { console.warn("sync pull failed", e); setStatus("error"); }
}

export async function startSync(userId) {
  stopSync(); uid = userId || "local";
  if (!cloudEnabled || uid === "local") return;
  await pull();
  channel = supabase.channel("kv-" + uid).on("postgres_changes", { event: "*", schema: "public", table: "kv", filter: `user_id=eq.${uid}` }, () => pull()).subscribe();
  window.addEventListener("online", onOnline); document.addEventListener("visibilitychange", onVis);
}
export function stopSync() { if (channel) { supabase.removeChannel(channel); channel = null; } window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVis); }
const onOnline = () => { pull(); };
const onVis = () => { if (document.visibilityState === "visible") pull(); };

// Used by the AI proxy calls
export async function authHeader() { if (!cloudEnabled) return {}; const { data } = await supabase.auth.getSession(); const t = data?.session?.access_token; return t ? { Authorization: `Bearer ${t}` } : {}; }

// AI call helper: sends the signed-in token (cloud mode) and/or the app passcode (local mode).
export async function aiFetch(body) {
  const go = async () => fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()), "x-app-passcode": ls.get("loop_passcode") || "" }, body: JSON.stringify(body) });
  let res = await go();
  if (res.status === 401 && !cloudEnabled) {
    const p = window.prompt("Enter your Loop passcode to use AI features:");
    if (p) { ls.set("loop_passcode", p); res = await go(); }
  }
  return res;
}

// Backup: download everything as one JSON file / restore from it.
export async function exportAll() {
  const out = {};
  for (const k of (await storage.list()).keys) out[k] = JSON.parse((await storage.get(k)).value);
  const blob = new Blob([JSON.stringify({ app: "loop", version: 1, exportedAt: new Date().toISOString(), data: out })], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `loop-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
}
export async function importAll(file) {
  const j = JSON.parse(await file.text());
  if (j.app !== "loop" || !j.data) throw new Error("Not a Loop backup file");
  for (const [k, v] of Object.entries(j.data)) await storage.set(k, JSON.stringify(v));
  return Object.keys(j.data).length;
}
