import { useState, useEffect, useRef } from "react";
import { authHeader } from "./sync.js";

/* ===========================================================
   Loop · a calm soft-tech wellness companion
   Twilight canvas, frosted glass, aurora accent, geometric sans.
   Same complete feature set as Nibbl — a premium, quiet personality.
   =========================================================== */

const ACCENTS = { coral: "#FF7A8A", violet: "#8B7CFF", cyan: "#4FD3D9", lime: "#8BE0A8", amber: "#FFC56E", rose: "#FF9EC4", sky: "#6FA8FF" };
const PILLARS = { food: "#FF7A8A", exercise: "#F5A623", steps: "#4A86F0", weight: "#8B7CFF", mood: "#EC6BB0", sleep: "#6C5CE7", water: "#22B8C9" };
const THEMES = {
  dark: {
    bg0: "#0E1020", bg1: "#171A2E", bg2: "#241B3A",
    glass: "rgba(255,255,255,0.06)", glassBright: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.12)",
    ink: "#F4F3FB", soft: "#AEB0C6", faint: "#6E7191",
    appBg: `radial-gradient(1100px 560px at 20% -8%, #241B3A, transparent 60%), radial-gradient(900px 520px at 90% 0%, #2a1d3e, transparent 55%), linear-gradient(180deg, #171A2E, #0E1020)`,
    sheetBg: `linear-gradient(180deg, #171A2E, #0E1020)`,
    setupBg: `radial-gradient(1200px 600px at 50% -10%, #241B3A, #0E1020)`,
    navBg: "rgba(14,16,32,0.8)", scoreTrack: "rgba(255,255,255,0.08)",
    ...ACCENTS, ...PILLARS,
  },
  light: {
    bg0: "#F4F5FA", bg1: "#FBFBFE", bg2: "#EEF0F8",
    glass: "rgba(255,255,255,0.75)", glassBright: "rgba(255,255,255,0.92)", stroke: "rgba(20,22,50,0.10)",
    ink: "#1C1E2E", soft: "#5A5E78", faint: "#9499B4",
    appBg: `radial-gradient(1100px 560px at 20% -8%, #ECE8FB, transparent 60%), radial-gradient(900px 520px at 90% 0%, #FCE7F0, transparent 55%), linear-gradient(180deg, #FBFBFE, #F1F2F9)`,
    sheetBg: `linear-gradient(180deg, #FFFFFF, #F4F5FA)`,
    setupBg: `radial-gradient(1200px 600px at 50% -10%, #ECE8FB, #F4F5FA)`,
    navBg: "rgba(255,255,255,0.85)", scoreTrack: "rgba(20,22,50,0.08)",
    ...ACCENTS, ...PILLARS,
  },
};
const C = { ...THEMES.dark };
const applyTheme = (name) => Object.assign(C, THEMES[name] || THEMES.dark);
const MOODS = ["😔", "😕", "😐", "🙂", "😄"];
const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];
const todayKey = () => new Date().toISOString().slice(0, 10);
const grad = `linear-gradient(135deg, ${C.coral}, ${C.violet})`;

const tdeeOf = ({ sex, age, heightCm, weightKg, activity }) => {
  const bmr = sex === "female" ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161 : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const f = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return bmr * (f[activity] || 1.2);
};
const HARD_FLOOR = 1000; // never overridable — below this needs medical supervision
const calcPlan = (p, cur, tgt, dateISO, floor = 1200) => {
  const tdee = tdeeOf({ ...p, weightKg: cur });
  const days = Math.max(1, Math.ceil((new Date(dateISO) - new Date()) / 86400000));
  const safeFloor = Math.max(HARD_FLOOR, floor || 1200);
  const raw = (Math.max(0, cur - tgt) * 7700) / days;          // deficit the chosen date implies
  const capped = Math.min(raw, 1000);                           // safety cap ~1kg/week
  const goalRaw = tdee - capped;
  const goal = Math.max(safeFloor, Math.round(goalRaw / 10) * 10);
  const actualDeficit = Math.max(0, tdee - goal);               // the deficit you'll REALLY run after the floor
  const floored = goalRaw < safeFloor;                          // did the floor bite?
  // TRUE projected date from the actual deficit (never promises a pace the calories can't deliver)
  const kg = Math.max(0, cur - tgt);
  let trueDate = dateISO, trueDays = days;
  if (actualDeficit > 0 && kg > 0) {
    trueDays = Math.ceil((kg * 7700) / actualDeficit);
    const d = new Date(); d.setDate(d.getDate() + trueDays); trueDate = d.toISOString().slice(0, 10);
  }
  return { goal, days, deficit: Math.round(actualDeficit), tdee: Math.round(tdee), capped: raw > 1000, floored, floor: safeFloor, trueDate, trueDays, requestedDeficit: Math.round(raw) };
};
const steadyDate = (cur, tgt) => { const wks = Math.max(1, Math.ceil(Math.max(0, cur - tgt) / 0.5)); const d = new Date(); d.setDate(d.getDate() + wks * 7); return d.toISOString().slice(0, 10); };
const exKcalFromMin = (m, w) => Math.round(m * (5 * 3.5 * (w > 0 ? w : 60) / 200));
const stepsKcal = (s, w) => Math.round(s * 0.04 * ((w > 0 ? w : 60) / 70));
const calcBurned = (s, m, d, mode, w) => stepsKcal(s, w) + (mode === "kcal" ? (d || 0) : exKcalFromMin(m, w));
const bmiOf = (w, h) => w / Math.pow(h / 100, 2);
const healthyRange = (h) => { const m = h / 100; return { min: +(18.5 * m * m).toFixed(1), max: +(24.9 * m * m).toFixed(1) }; };
const macroTargets = (tw, g) => ({ protein: Math.round((tw || 55) * 1.6), fat: Math.round(g * 0.30 / 9), fibre: 28, sugar: Math.round(g * 0.10 / 4), netCarbs: Math.round(g * 0.45 / 4) });

const STATUS = { good: { color: "#8BE0A8", label: "Healthy" }, border: { color: "#FFC56E", label: "Borderline" }, high: { color: "#FF7A8A", label: "High" }, low: { color: "#6FA8FF", label: "Low" } };
const fmtNum = (n) => Math.abs(n) >= 100 ? Math.round(n) : +(Math.round(n * 10) / 10);
const evalStatus = (value, band, unit = "") => {
  if (value == null || isNaN(value) || !band) return null;
  const [lo, hi] = band.good; const u = unit || ""; let pos = 0.5;
  if (lo != null && hi != null && hi !== lo) pos = (value - lo) / (hi - lo);
  if (lo != null && value < lo) return { ...STATUS.low, detail: `${fmtNum(lo - value)}${u} below healthy (min ${lo}${u})`, pos };
  if (hi != null && value <= hi) { if (hi >= 900) return { ...STATUS.good, detail: `In healthy range (\u2265 ${lo}${u})`, pos: Math.min(pos, 1) }; return { ...STATUS.good, detail: `Healthy · ${fmtNum(hi - value)}${u} headroom before borderline`, pos: Math.max(0, Math.min(pos, 1)) }; }
  if (band.borderHigh != null && value <= band.borderHigh) return { ...STATUS.border, detail: `${fmtNum(value - hi)}${u} above healthy · ${fmtNum(value - hi)}${u} to return`, pos };
  return { ...STATUS.high, detail: `${fmtNum(value - hi)}${u} above the healthy max (${hi}${u})`, pos };
};
const bandFor = (key, sex, age) => {
  const female = sex !== "male";
  switch (key) {
    case "bodyFat": return female ? { good: [21, 33], borderHigh: 39 } : { good: [8, 20], borderHigh: 25 };
    case "subcutaneous": return female ? { good: [18, 26], borderHigh: 31 } : { good: [10, 20], borderHigh: 25 };
    case "skeletalMuscle": return female ? { good: [24, 30], borderHigh: 999 } : { good: [33, 39], borderHigh: 999 };
    case "visceral": return { good: [1, 9], borderHigh: 14 };
    case "bmi": return { good: [18.5, 24.9], borderHigh: 29.9 };
    case "bodyAge": return age ? { good: [0, age], borderHigh: age + 5 } : null;
    default: return null;
  }
};

const store = {
  async get(k, d) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : d; } catch { return d; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
};
// Downscale to JPEG (max 1280px) so photos stay small for cloud sync and AI upload.
const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => { const m = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * m); c.height = Math.round(img.height * m); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8).split(",")[1]); }; img.src = r.result; }; r.readAsDataURL(f); });

let _ac = null;
const sound = {
  on: true,
  ctx() { if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return _ac; },
  play(fr, dur = 0.09) { if (!this.on) return; const a = this.ctx(); if (!a) return; if (a.state === "suspended") a.resume(); fr.forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f; const t = a.currentTime + i * dur; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur); }); },
  tap() { this.play([523]); }, add() { this.play([587, 784]); }, win() { this.play([523, 659, 880, 1047]); },
};
async function askAI(system, content, max = 1000) {
  const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ max_tokens: max, system, messages: [{ role: "user", content }] }) });
  const raw = await res.text(); if (!res.ok) { let m = ""; try { const j = JSON.parse(raw); m = j.error?.message || j.error || ""; } catch {} throw new Error("HTTP " + res.status + (m ? " – " + m : "")); }
  const json = JSON.parse(raw); return (json.content || []).filter(b => b.type === "text").map(b => b.text).join(" ");
}

const _sw = {}, _sh = {}, _cd = {};
Object.defineProperty(_sw, "v", { get: () => ({ position: "fixed", inset: 0, background: C.bg0 === "#0E1020" ? "rgba(8,9,18,0.6)" : "rgba(28,30,46,0.35)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }) });
Object.defineProperty(_sh, "v", { get: () => ({ background: C.sheetBg, width: "100%", maxWidth: 470, height: "92vh", display: "flex", flexDirection: "column", borderTop: `1px solid ${C.stroke}`, borderRadius: "28px 28px 0 0", boxShadow: "0 -20px 60px rgba(0,0,0,0.35)" }) });
Object.defineProperty(_cd, "v", { get: () => ({ background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 22, backdropFilter: "blur(20px)" }) });
const mkProxy = (src) => new Proxy({}, { get: (_, k) => src.v[k], ownKeys: () => Reflect.ownKeys(src.v), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
const sheetWrap = mkProxy(_sw);
const sheet = mkProxy(_sh);
const FONT = "'Sora',system-ui,sans-serif";
const card = mkProxy(_cd);
function Head({ title, onClose }) {
  return <div style={{ padding: "20px 22px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.stroke}` }}>
    <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>{title}</div>
    <div onClick={onClose} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: "50%", background: C.glass, border: `1px solid ${C.stroke}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.soft, fontSize: 15 }}>✕</div>
  </div>;
}
function Bar({ value, max, color }) {
  const pct = Math.min((value / max) * 100, 100), over = value > max;
  return <div style={{ background: C.scoreTrack, height: 8, borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: over ? C.coral : (color || grad), borderRadius: 99, transition: "width .6s cubic-bezier(.2,.8,.2,1)", boxShadow: over ? "none" : `0 0 12px ${color || C.violet}66` }} /></div>;
}
function Field({ value, onChange, placeholder, suffix }) {
  return <div style={{ display: "flex", alignItems: "baseline", gap: 8, background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "12px 14px" }}>
    <input type="number" inputMode="decimal" value={value || ""} placeholder={placeholder} onChange={e => onChange(e.target.value === "" ? 0 : Math.max(0, +e.target.value))} onClick={e => e.stopPropagation()} style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 26, fontWeight: 700, fontFamily: FONT, color: C.ink, width: "100%" }} />
    {suffix && <span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>{suffix}</span>}
  </div>;
}
const PhotoBtns = ({ onPhoto, idns }) => {
  const ov = { position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" };
  const s = { flex: 1, position: "relative", border: `1px solid ${C.stroke}`, color: C.ink, padding: "13px 0", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", display: "block", background: C.glass, borderRadius: 14, fontFamily: FONT };
  return <div>
    <div style={{ display: "flex", gap: 10 }}>
      <label htmlFor={idns + "c"} style={s}>📷 Camera<input id={idns + "c"} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={ov} /></label>
      <label htmlFor={idns + "u"} style={s}>🖼 Upload<input id={idns + "u"} type="file" accept="image/*" onChange={onPhoto} style={ov} /></label>
    </div>
    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8, textAlign: "center" }}>If a tap does nothing, your device may block in-app camera access — try claude.ai in a browser.</div>
  </div>;
};

const CELEBRATE_COLORS = () => [C.coral, C.violet, C.cyan, C.lime, C.amber, C.rose, C.sky];
const rand = (a, b) => a + Math.random() * (b - a);

function Confetti() {
  const COLORS = CELEBRATE_COLORS();
  const pieces = Array.from({ length: 90 }, (_, i) => ({ id: i, left: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.6, size: 7 + Math.random() * 7, rot: Math.random() * 360, drift: (Math.random() - 0.5) * 220, round: Math.random() > 0.6 }));
  return <>
    <style>{`@keyframes confFall{0%{transform:translateY(-12vh) translateX(0) rotate(0deg);opacity:1;}100%{transform:translateY(110vh) translateX(var(--dx)) rotate(var(--rot));opacity:0.9;}}`}</style>
    {pieces.map(p => <div key={p.id} style={{ position: "absolute", top: 0, left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.5, background: p.color, borderRadius: p.round ? "50%" : 2, "--dx": `${p.drift}px`, "--rot": `${p.rot + 540}deg`, animation: `confFall ${p.dur}s cubic-bezier(.3,.6,.4,1) ${p.delay}s forwards`, boxShadow: `0 0 6px ${p.color}88` }} />)}
  </>;
}

function Fireworks() {
  const COLORS = CELEBRATE_COLORS();
  const bursts = Array.from({ length: 6 }, (_, b) => ({ id: b, cx: rand(15, 85), cy: rand(15, 55), color: COLORS[b % COLORS.length], delay: b * 0.55 + Math.random() * 0.2, sparks: 18 }));
  return <>
    <style>{`@keyframes fwSpark{0%{transform:translate(0,0) scale(1);opacity:1;}100%{transform:translate(var(--sx),var(--sy)) scale(0.3);opacity:0;}}@keyframes fwRise{0%{transform:translateY(80vh);opacity:0;}60%{opacity:1;}100%{transform:translateY(0);opacity:0;}}`}</style>
    {bursts.map(b => <div key={b.id} style={{ position: "absolute", left: `${b.cx}%`, top: `${b.cy}%` }}>
      <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: b.color, animation: `fwRise 0.6s ease-out ${b.delay}s` }} />
      {Array.from({ length: b.sparks }).map((_, s) => { const ang = (s / b.sparks) * Math.PI * 2, dist = rand(70, 130); return <div key={s} style={{ position: "absolute", width: 5, height: 5, borderRadius: "50%", background: b.color, "--sx": `${Math.cos(ang) * dist}px`, "--sy": `${Math.sin(ang) * dist}px`, animation: `fwSpark 1.1s ease-out ${b.delay + 0.55}s forwards`, opacity: 0, boxShadow: `0 0 8px ${b.color}` }} />; })}
    </div>)}
  </>;
}

function Disco() {
  const COLORS = CELEBRATE_COLORS();
  const beams = Array.from({ length: 8 }, (_, i) => ({ id: i, color: COLORS[i % COLORS.length], rot: (i / 8) * 360, delay: i * 0.08 }));
  const dots = Array.from({ length: 30 }, (_, i) => ({ id: i, left: Math.random() * 100, top: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 1.2, size: rand(6, 14) }));
  return <>
    <style>{`@keyframes discoSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}@keyframes discoFlash{0%,100%{background:rgba(255,255,255,0);}50%{background:rgba(255,255,255,0.06);}}@keyframes discoPulse{0%,100%{opacity:0.15;transform:scale(0.8);}50%{opacity:0.9;transform:scale(1.3);}}`}</style>
    <div style={{ position: "absolute", inset: 0, animation: "discoFlash 0.5s ease-in-out infinite" }} />
    <div style={{ position: "absolute", left: "50%", top: "40%", width: 0, height: 0, animation: "discoSpin 3s linear infinite" }}>
      {beams.map(b => <div key={b.id} style={{ position: "absolute", left: 0, top: 0, width: "60vw", height: 70, background: `linear-gradient(90deg, ${b.color}00, ${b.color}55, ${b.color}00)`, transformOrigin: "0 50%", transform: `rotate(${b.rot}deg)`, filter: "blur(6px)" }} />)}
    </div>
    {dots.map(d => <div key={d.id} style={{ position: "absolute", left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, borderRadius: "50%", background: d.color, animation: `discoPulse 0.9s ease-in-out ${d.delay}s infinite`, boxShadow: `0 0 12px ${d.color}` }} />)}
  </>;
}

function Balloons() {
  const COLORS = CELEBRATE_COLORS();
  const balloons = Array.from({ length: 18 }, (_, i) => ({ id: i, left: Math.random() * 92, color: COLORS[i % COLORS.length], delay: Math.random() * 1, dur: 5 + Math.random() * 1.5, size: rand(34, 56), sway: (Math.random() - 0.5) * 90 }));
  return <>
    <style>{`@keyframes balloonRise{0%{transform:translateY(110vh) translateX(0);opacity:0;}8%{opacity:1;}92%{opacity:1;}100%{transform:translateY(-40vh) translateX(var(--sway));opacity:0;}}@keyframes balloonSway{0%,100%{margin-left:0;}50%{margin-left:18px;}}`}</style>
    {balloons.map(b => <div key={b.id} style={{ position: "absolute", top: 0, left: `${b.left}%`, "--sway": `${b.sway}px`, animation: `balloonRise ${b.dur}s ease-out ${b.delay}s both` }}>
      <div style={{ animation: `balloonSway ${rand(2, 3.5)}s ease-in-out infinite` }}>
        <div style={{ width: b.size, height: b.size * 1.2, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, #ffffffaa, ${b.color})`, boxShadow: `0 0 16px ${b.color}66` }} />
        <div style={{ width: 1, height: 46, background: C.stroke, margin: "0 auto" }} />
      </div>
    </div>)}
  </>;
}

function Bubbles() {
  const COLORS = CELEBRATE_COLORS();
  const bubbles = Array.from({ length: 28 }, (_, i) => ({ id: i, left: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 1.2, dur: 4.5 + Math.random() * 1.5, size: rand(12, 46), sway: (Math.random() - 0.5) * 70 }));
  return <>
    <style>{`@keyframes bubbleRise{0%{transform:translateY(110vh) translateX(0);opacity:0;}10%{opacity:0.9;}90%{opacity:0.9;}100%{transform:translateY(-30vh) translateX(var(--sway));opacity:0;}}`}</style>
    {bubbles.map(b => <div key={b.id} style={{ position: "absolute", top: 0, left: `${b.left}%`, width: b.size, height: b.size, borderRadius: "50%", "--sway": `${b.sway}px`, background: `radial-gradient(circle at 32% 28%, #ffffffcc, ${b.color}33 55%, ${b.color}11)`, border: `1px solid ${b.color}66`, boxShadow: `0 0 12px ${b.color}55, inset 0 0 8px ${b.color}33`, animation: `bubbleRise ${b.dur}s ease-in-out ${b.delay}s both` }} />)}
  </>;
}

function SparkleRain() {
  const COLORS = CELEBRATE_COLORS();
  const sparks = Array.from({ length: 60 }, (_, i) => ({ id: i, left: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 2, dur: 2.2 + Math.random() * 2, size: rand(8, 20) }));
  return <>
    <style>{`@keyframes sparkleFall{0%{transform:translateY(-10vh) scale(0);opacity:0;}20%{opacity:1;transform:translateY(10vh) scale(1);}100%{transform:translateY(110vh) scale(0.4);opacity:0;}}@keyframes sparkleTwinkle{0%,100%{opacity:1;}50%{opacity:0.3;}}`}</style>
    {sparks.map(s => <div key={s.id} style={{ position: "absolute", top: 0, left: `${s.left}%`, fontSize: s.size, color: s.color, lineHeight: 1, textShadow: `0 0 8px ${s.color}`, animation: `sparkleFall ${s.dur}s ease-in ${s.delay}s forwards` }}><span style={{ display: "inline-block", animation: `sparkleTwinkle 0.5s ease-in-out infinite` }}>✨</span></div>)}
  </>;
}

function Streamers() {
  const COLORS = CELEBRATE_COLORS();
  const ribbons = Array.from({ length: 22 }, (_, i) => ({ id: i, left: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 0.4, dur: 3 + Math.random() * 2, drift: (Math.random() - 0.5) * 160, len: rand(40, 90), wobble: rand(2, 4) }));
  return <>
    <style>{`@keyframes streamerFall{0%{transform:translateY(-15vh) translateX(0) rotate(0deg);opacity:1;}100%{transform:translateY(115vh) translateX(var(--dx)) rotate(720deg);opacity:0.85;}}@keyframes streamerWave{0%,100%{transform:skewX(-12deg);}50%{transform:skewX(12deg);}}`}</style>
    {ribbons.map(r => <div key={r.id} style={{ position: "absolute", top: 0, left: `${r.left}%`, "--dx": `${r.drift}px`, animation: `streamerFall ${r.dur}s cubic-bezier(.4,.2,.5,1) ${r.delay}s forwards` }}>
      <div style={{ width: 7, height: r.len, background: `linear-gradient(180deg, ${r.color}, ${r.color}55)`, borderRadius: 4, animation: `streamerWave ${r.wobble * 0.25}s ease-in-out infinite`, boxShadow: `0 0 6px ${r.color}88` }} />
    </div>)}
  </>;
}

const EFFECTS = [Confetti, Fireworks, Disco, Balloons, Starburst, Bubbles, SparkleRain, Streamers];

function Starburst() {
  const COLORS = CELEBRATE_COLORS();
  const stars = Array.from({ length: 40 }, (_, i) => ({ id: i, left: Math.random() * 100, top: Math.random() * 100, color: COLORS[i % COLORS.length], delay: Math.random() * 1.5, size: rand(10, 26) }));
  return <>
    <style>{`@keyframes starPop{0%{transform:scale(0) rotate(0deg);opacity:0;}40%{transform:scale(1.2) rotate(90deg);opacity:1;}100%{transform:scale(0) rotate(180deg);opacity:0;}}`}</style>
    {stars.map(s => <div key={s.id} style={{ position: "absolute", left: `${s.left}%`, top: `${s.top}%`, fontSize: s.size, color: s.color, animation: `starPop 1.6s ease-out ${s.delay}s infinite`, textShadow: `0 0 10px ${s.color}`, lineHeight: 1 }}>✦</div>)}
  </>;
}

function Celebration({ index, onDone }) {
  const Effect = EFFECTS[index % EFFECTS.length] || Confetti;
  useEffect(() => { const t = setTimeout(onDone, 6500); return () => clearTimeout(t); }, [onDone]);
  return <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3000, overflow: "hidden", animation: "celebFade 6.5s ease-out forwards" }}>
    <style>{`@keyframes celebFade{0%,80%{opacity:1;}100%{opacity:0;}}`}</style>
    <Effect />
  </div>;
}
function Ring({ score, size = 132 }) {
  const r = (size - 18) / 2, c = 2 * Math.PI * r, off = c - (Math.min(score, 100) / 100) * c, id = "lr" + size;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.coral} /><stop offset="0.5" stopColor={C.rose} /><stop offset="1" stopColor={C.violet} /></linearGradient></defs>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.scoreTrack} strokeWidth="9" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth="9" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 6px rgba(139,124,255,0.5))" }} />
    <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.3} fontWeight="800" fill={C.ink} fontFamily={FONT}>{score}</text>
    <text x="50%" y="64%" textAnchor="middle" fontSize="11" fill={C.soft} fontFamily={FONT} letterSpacing="2">LOOP</text>
  </svg>;
}

function Glass({ filled, onClick }) {
  // a tapered drinking glass; fills with water when counted
  return <svg width="26" height="34" viewBox="0 0 26 34" onClick={onClick} style={{ cursor: "pointer", flex: "0 0 auto" }}>
    <defs><clipPath id="gcup"><path d="M5 3 L21 3 L19 31 Q19 32 18 32 L8 32 Q7 32 7 31 Z" /></clipPath></defs>
    {filled && <rect x="0" y="6" width="26" height="28" fill={C.water} clipPath="url(#gcup)" opacity="0.92" />}
    {filled && <ellipse cx="13" cy="8" rx="8" ry="1.6" fill="#fff" opacity="0.35" />}
    <path d="M5 3 L21 3 L19 31 Q19 32 18 32 L8 32 Q7 32 7 31 Z" fill="none" stroke={filled ? C.water : C.stroke} strokeWidth="1.6" style={{ filter: filled ? `drop-shadow(0 0 5px ${C.water}88)` : "none" }} />
  </svg>;
}
function Setup({ initial, onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(initial || { sex: "female", age: 45, heightCm: 160, weightKg: 56.5, activity: "light", targetWeight: 53, targetDate: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const eff = f.targetDate || steadyDate(f.weightKg, f.targetWeight);
  const plan = calcPlan(f, f.weightKg, f.targetWeight, eff);
  const range = healthyRange(f.heightCm), below = f.targetWeight < range.min;
  const lab = { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, marginBottom: 10, display: "block", fontWeight: 600 };
  const inp = { width: "100%", background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "12px 14px", fontSize: 22, fontFamily: FONT, fontWeight: 700, outline: "none", color: C.ink };
  const pill = (k, opts) => <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{opts.map(([v, l]) => <button key={v} onClick={() => set(k, v)} style={{ border: `1px solid ${f[k] === v ? "transparent" : C.stroke}`, background: f[k] === v ? grad : C.glass, color: f[k] === v ? "#fff" : C.soft, padding: "10px 18px", fontSize: 13, fontWeight: 600, borderRadius: 99, cursor: "pointer", fontFamily: FONT }}>{l}</button>)}</div>;
  return <div style={{ minHeight: "100vh", background: C.setupBg, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
    <div style={{ maxWidth: 380, width: "100%" }}>
      <div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Loop</div>
      <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.faint, marginTop: 4, marginBottom: 36, fontWeight: 600 }}>Find your rhythm · {step + 1} of 3</div>
      {step === 0 && <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div><label style={lab}>I am</label>{pill("sex", [["female", "Female"], ["male", "Male"]])}</div>
        <div style={{ display: "flex", gap: 16 }}><div style={{ flex: 1 }}><label style={lab}>Age</label><input type="number" style={inp} value={f.age} onChange={e => set("age", +e.target.value)} /></div><div style={{ flex: 1 }}><label style={lab}>Height · cm</label><input type="number" style={inp} value={f.heightCm} onChange={e => set("heightCm", +e.target.value)} /></div></div>
        <div><label style={lab}>Current weight · kg</label><input type="number" step="0.1" style={inp} value={f.weightKg} onChange={e => set("weightKg", +e.target.value)} /></div>
      </div>}
      {step === 1 && <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div><label style={lab}>Daily activity</label>{pill("activity", [["sedentary", "Low"], ["light", "Light"], ["moderate", "Moderate"], ["active", "Active"]])}</div>
        <div><label style={lab}>Goal weight · kg</label><input type="number" step="0.1" style={inp} value={f.targetWeight} onChange={e => set("targetWeight", +e.target.value)} />
          <div style={{ marginTop: 10, fontSize: 12.5, color: C.soft, lineHeight: 1.5 }}>Healthy range {range.min}–{range.max} kg.{below && <span style={{ color: C.coral }}> Below healthy — consider {range.min}kg+ and consult a doctor.</span>}</div>
        </div>
        <div><label style={lab}>Target date · optional</label><input type="date" style={inp} value={f.targetDate} min={todayKey()} onChange={e => set("targetDate", e.target.value)} /><div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>Leave blank for a steady ~0.5kg/week pace.</div></div>
      </div>}
      {step === 2 && <div>
        <label style={lab}>Your daily target</label>
        <div style={{ fontFamily: FONT, fontSize: 70, fontWeight: 800, lineHeight: 1, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{plan.goal}</div>
        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, marginTop: 8, marginBottom: 22, fontWeight: 600 }}>kcal / day</div>
        <div style={{ ...card, padding: 16, fontSize: 14, color: C.soft, lineHeight: 1.9 }}>
          <div>Maintenance · {plan.tdee} kcal</div><div>Daily deficit · −{plan.deficit} kcal</div>
          <div>Projected to reach {f.targetWeight}kg around {new Date(plan.trueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ~{plan.trueDays} days</div>
        </div>
        {plan.floored && <div style={{ marginTop: 14, fontSize: 12.5, color: C.amber, lineHeight: 1.6 }}>To keep you at a safe minimum of {plan.floor} kcal, the pace is gentler than your target date — so the projected date above is the realistic one. A steady arrival is the healthy way there.</div>}
        {plan.capped && !plan.floored && <div style={{ marginTop: 14, fontSize: 12.5, color: C.amber, lineHeight: 1.6 }}>That date is ambitious — safely capped at ~1kg/week, so the projected date above reflects the real, healthy pace.</div>}
        <div style={{ marginTop: 18, fontSize: 11, color: C.faint, lineHeight: 1.6 }}>General estimates, not medical advice. Loop keeps a safe minimum of 1,200 kcal and a steady pace. Consult a doctor or dietitian before any weight plan.</div>
      </div>}
      <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
        {step > 0 && <button onClick={() => { sound.tap(); setStep(step - 1); }} style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: C.soft, padding: "15px 0", flex: 1, fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 16, fontFamily: FONT }}>Back</button>}
        <button onClick={() => { sound.tap(); step < 2 ? setStep(step + 1) : onDone({ calorieGoal: plan.goal, tdee: plan.tdee, deficit: plan.deficit, targetWeight: f.targetWeight, targetDate: eff, weight: f.weightKg, profile: f }); }} style={{ border: "none", background: grad, color: "#fff", padding: "15px 0", flex: 2, fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 16, fontFamily: FONT, boxShadow: `0 8px 24px ${C.violet}55` }}>{step < 2 ? "Continue" : "Start the loop"}</button>
      </div>
    </div>
  </div>;
}

function FoodLog({ goal, macroGoals, entries, favourites, onAdd, onRemove, onToggleFav, onClose }) {
  const [desc, setDesc] = useState(""), [loading, setLoading] = useState(false), [status, setStatus] = useState(""), [manualCal, setManualCal] = useState(""), [preview, setPreview] = useState(null), [meal, setMeal] = useState("Breakfast");
  const sum = (k) => entries.reduce((s, e) => s + (e[k] || 0), 0);
  const total = sum("calories"), remaining = goal - total;
  const macros = { protein: sum("protein"), fat: sum("fat"), netCarbs: sum("netCarbs"), fibre: sum("fibre"), sugar: sum("sugar") };
  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const parse = async (content) => {
    const text = await askAI('Nutrition estimator. Estimate calories and macros (g) for the food, typical portions. Respond ONLY JSON: {"name":"short name","calories":n,"protein":n,"fat":n,"carbs":n,"fibre":n,"sugar":n}', content);
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error("Couldn't read estimate");
    const o = JSON.parse(m[0]); const carbs = Math.round(+o.carbs || 0), fibre = Math.round(+o.fibre || 0);
    return { name: o.name, calories: Math.round(+o.calories || 0), protein: Math.round(+o.protein || 0), fat: Math.round(+o.fat || 0), fibre, sugar: Math.round(+o.sugar || 0), netCarbs: Math.max(0, carbs - fibre) };
  };
  const estimate = async () => { if (!desc.trim()) { setStatus("Type a food first."); return; } setLoading(true); setStatus("Estimating…"); try { const p = await parse(desc); onAdd({ id: Date.now(), ...p, name: p.name || desc, meal }); setDesc(""); setStatus(""); } catch (e) { setStatus(e.message + " — or enter kcal manually."); } finally { setLoading(false); } };
  const onPhoto = async (e) => { const file = e.target.files?.[0]; if (!file) return; setLoading(true); setStatus("Analysing photo…"); try { const b64 = await fileToB64(file); setPreview(`data:image/jpeg;base64,${b64}`); const p = await parse([{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: "Estimate calories and macros of this meal." }]); onAdd({ id: Date.now(), ...p, name: p.name || "Photo meal", meal }); setStatus(""); } catch (err) { setStatus(err.message + " — or enter kcal manually."); } finally { setLoading(false); setTimeout(() => setPreview(null), 1400); e.target.value = ""; } };
  const addManual = () => { if (!desc.trim() || !manualCal) { setStatus("Need a food name and kcal."); return; } onAdd({ id: Date.now(), name: desc, calories: Math.round(+manualCal) || 0, protein: 0, fat: 0, fibre: 0, sugar: 0, netCarbs: 0, meal }); setDesc(""); setManualCal(""); setStatus(""); };
  const isFav = (n) => favourites.some(f => f.name === n);
  const macroChip = (label, v, g, col) => <div style={{ flex: "1 1 84px", minWidth: 78, ...card, padding: "10px 12px" }}><div style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 16, color: C.ink, fontWeight: 700, margin: "2px 0 6px" }}>{v}<span style={{ fontSize: 11, color: C.faint, fontWeight: 500 }}> /{g}g</span></div><Bar value={v} max={g} color={col} /></div>;
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={sheet}>
    <Head title="Food" onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
      <div style={{ ...card, padding: 18, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Eaten</div><div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{total}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{remaining >= 0 ? "Left" : "Over"}</div><div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 800, color: remaining >= 0 ? C.lime : C.coral, lineHeight: 1 }}>{Math.abs(remaining)}</div></div>
      </div>
      <div style={{ marginBottom: 16 }}><Bar value={total} max={goal} /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {macroChip("Protein", macros.protein, macroGoals.protein, C.violet)}
        {macroChip("Fat", macros.fat, macroGoals.fat, C.amber)}
        {macroChip("Net carbs", macros.netCarbs, macroGoals.netCarbs, C.sky)}
        {macroChip("Fibre", macros.fibre, macroGoals.fibre, C.lime)}
        {macroChip("Sugar", macros.sugar, macroGoals.sugar, C.coral)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: C.glass, borderRadius: 99, padding: 4, border: `1px solid ${C.stroke}` }}>{MEALS.map(m => <button key={m} onClick={() => setMeal(m)} style={{ flex: 1, border: "none", background: meal === m ? grad : "transparent", color: meal === m ? "#fff" : C.soft, padding: "8px 0", fontSize: 12, fontWeight: 600, borderRadius: 99, cursor: "pointer", fontFamily: FONT }}>{m}</button>)}</div>
      <PhotoBtns onPhoto={onPhoto} idns="food" />
      {preview && <img src={preview} alt="" style={{ width: "100%", margin: "14px 0", maxHeight: 140, objectFit: "cover", borderRadius: 16, border: `1px solid ${C.stroke}` }} />}
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe a food…" onKeyDown={e => e.key === "Enter" && estimate()} style={{ width: "100%", background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "13px 14px", fontSize: 15, outline: "none", color: C.ink, margin: "14px 0", fontFamily: FONT }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={estimate} style={{ flex: 2, border: "none", background: grad, color: "#fff", padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 14, fontFamily: FONT, opacity: loading ? .6 : 1 }}>{loading ? "Working…" : "✨ Estimate"}</button>
        <input value={manualCal} onChange={e => setManualCal(e.target.value)} type="number" placeholder="kcal" style={{ width: 66, background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "0 10px", fontSize: 14, textAlign: "center", outline: "none", color: C.ink, fontFamily: FONT }} />
        <button onClick={addManual} style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: C.ink, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 14, fontFamily: FONT }}>Add</button>
      </div>
      {status && <div style={{ fontSize: 12.5, color: C.coral, marginTop: 10, lineHeight: 1.4 }}>{status}</div>}
      {favourites.length > 0 && <div style={{ marginTop: 18 }}><div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Favourites</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{favourites.map((fa, i) => <button key={i} onClick={() => onAdd({ id: Date.now(), ...fa, meal })} style={{ border: `1px solid ${C.stroke}`, background: C.glass, padding: "8px 13px", fontSize: 12.5, color: C.soft, cursor: "pointer", borderRadius: 99, fontFamily: FONT }}>{fa.name} · {fa.calories}</button>)}</div></div>}
      <div style={{ marginTop: 18 }}>
        {entries.length === 0 && <div style={{ textAlign: "center", color: C.faint, fontSize: 14, marginTop: 18 }}>Nothing logged yet</div>}
        {MEALS.map(mm => { const items = entries.filter(e => (e.meal || "Snack") === mm); if (!items.length) return null; const sub = items.reduce((s, e) => s + e.calories, 0);
          return <div key={mm} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{mm}</span><span style={{ fontSize: 11, color: C.faint }}>{sub} kcal</span></div>
            {items.map(e => <div key={e.id} style={{ ...card, display: "flex", alignItems: "center", padding: "12px 14px", marginBottom: 8 }}>
              <div onClick={() => onToggleFav(e)} style={{ cursor: "pointer", fontSize: 15, marginRight: 12, color: isFav(e.name) ? C.amber : C.faint }}>{isFav(e.name) ? "★" : "☆"}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, color: C.ink, fontWeight: 600 }}>{e.name}</div>{(e.protein || e.fat || e.netCarbs) ? <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>P{e.protein||0} · Fat{e.fat||0} · NC{e.netCarbs||0} · Fib{e.fibre||0} · S{e.sugar||0}</div> : null}</div>
              <div style={{ fontSize: 16, color: C.ink, fontWeight: 700, marginRight: 12 }}>{e.calories}</div>
              <div onClick={() => onRemove(e.id)} style={{ cursor: "pointer", color: C.faint, fontSize: 16 }}>✕</div>
            </div>)}
          </div>; })}
      </div>
    </div>
  </div></div>;
}

function BodyComp({ onSaveEntry, onClose }) {
  const FIELDS = [["bodyFat", "Body fat", "%"], ["subcutaneous", "Subcutaneous fat", "%"], ["skeletalMuscle", "Skeletal muscle", "%"], ["visceral", "Visceral fat", ""], ["restingMetabolism", "Resting metabolism", "kcal"], ["bodyAge", "Body age", "yrs"], ["bmi", "BMI", ""]];
  const [vals, setVals] = useState({}), [analysis, setAnalysis] = useState(""), [loading, setLoading] = useState(false);
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const interpret = async () => {
    const filled = Object.entries(vals).filter(([, v]) => v !== "" && v != null); if (!filled.length) { setAnalysis("Enter at least one reading first."); return; }
    setLoading(true); setAnalysis("Reading…");
    try { const readout = filled.map(([k, v]) => { const f = FIELDS.find(x => x[0] === k); return `${f[1]}: ${v}${f[2]}`; }).join(", ");
      const text = await askAI("Interpret body-composition scale readings (Omron, Hume, Tanita) for a general adult. Two labelled parts: 'What this means' (each metric vs typical healthy range, plain English) and 'How to improve' (3-5 specific, safe, actionable tips). End: estimates, not a diagnosis; see a professional. Never alarming.", "My readings: " + readout, 1200);
      setAnalysis(text); onSaveEntry({ date: todayKey(), vals, analysis: text }); } catch (e) { setAnalysis(e.message); } finally { setLoading(false); }
  };
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={sheet}>
    <Head title="Body" onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
      <div style={{ fontSize: 13, color: C.soft, marginBottom: 16, lineHeight: 1.5 }}>Enter readings from your smart scale. Fill only what you have — saved figures chart over time in Progress.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{FIELDS.map(([k, l, u]) => <div key={k}><label style={{ fontSize: 11, color: C.faint, fontWeight: 600, display: "block", marginBottom: 6 }}>{l}{u && ` · ${u}`}</label><input type="number" inputMode="decimal" value={vals[k] ?? ""} onChange={e => set(k, e.target.value)} style={{ width: "100%", background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: "10px 12px", fontSize: 19, fontFamily: FONT, fontWeight: 700, outline: "none", color: C.ink }} /></div>)}</div>
      <button onClick={interpret} style={{ width: "100%", border: "none", background: grad, color: "#fff", padding: 15, fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 16, marginTop: 22, fontFamily: FONT, boxShadow: `0 8px 24px ${C.violet}44` }}>{loading ? "Interpreting…" : "✨ Interpret & save"}</button>
      {analysis && <div style={{ ...card, padding: 16, marginTop: 18, fontSize: 14, color: C.ink, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{analysis}</div>}
      <div style={{ fontSize: 11, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>Impedance readings vary with hydration and time of day. Informational only, not a medical diagnosis.</div>
    </div>
  </div></div>;
}

function Plot({ data, color, label, unit, goalLine, status }) {
  if (!data.length) return <div style={{ fontSize: 13, color: C.faint, padding: "12px 0" }}>No data yet</div>;
  const W = 320, H = 92, pad = 5, vals = data.map(d => d.value);
  let mn = Math.min(...vals, goalLine ?? Infinity), mx = Math.max(...vals, goalLine ?? -Infinity); if (mn === mx) { mn -= 1; mx += 1; }
  const x = i => pad + (i / Math.max(data.length - 1, 1)) * (W - 2 * pad), y = v => H - pad - ((v - mn) / (mx - mn)) * (H - 2 * pad);
  const id = "g" + label.replace(/\W/g, "");
  return <div style={{ ...card, padding: 16, marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}><span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>{label}</span><span style={{ fontSize: 17, color: C.ink, fontWeight: 700 }}>{data[data.length - 1].value}{unit}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {goalLine != null && <line x1={pad} y1={y(goalLine)} x2={W - pad} y2={y(goalLine)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3" strokeWidth="1" />}
      <polygon points={`${pad},${H - pad} ` + data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ") + ` ${W - pad},${H - pad}`} fill={`url(#${id})`} />
      <polyline points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="2.6" fill={color} />)}
    </svg>
    {status && status.detail && <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 6, borderRadius: 99, background: "linear-gradient(90deg,#6FA8FF 0%,#6FA8FF 18%,#8BE0A8 22%,#8BE0A8 78%,#FFC56E 82%,#FF7A8A 100%)" }}>
        <div style={{ position: "absolute", top: -3, left: `${Math.max(2, Math.min(98, 22 + (typeof status.pos === "number" ? status.pos : 0.5) * 56))}%`, transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: C.bg0, border: `2.5px solid ${status.color}` }} />
      </div>
      <div style={{ fontSize: 11, color: status.color, marginTop: 6, fontWeight: 600 }}>{status.detail}</div>
    </div>}
  </div>;
}
function Progress({ history, bodyLog, data, onClose }) {
  const days = Object.keys(history).sort(), fmt = k => new Date(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const wd = days.filter(k => history[k].weight > 0).map(k => ({ date: fmt(k), value: history[k].weight }));
  const cd = days.filter(k => history[k].calories != null).map(k => ({ date: fmt(k), value: history[k].calories }));
  const bDays = Object.keys(bodyLog || {}).sort();
  const BF = [["bodyFat", "Body fat", "%", C.coral], ["subcutaneous", "Subcutaneous fat", "%", C.amber], ["skeletalMuscle", "Skeletal muscle", "%", C.lime], ["visceral", "Visceral fat", "", C.rose], ["restingMetabolism", "Resting metabolism", " kcal", C.sky], ["bodyAge", "Body age", " yrs", C.violet], ["bmi", "BMI", "", C.cyan]];
  const seriesFor = k => bDays.filter(d => bodyLog[d].vals?.[k] !== "" && bodyLog[d].vals?.[k] != null).map(d => ({ date: fmt(d), value: +bodyLog[d].vals[k] }));
  const prof = data.profile || {};
  let weightStatus = null;
  if (data.weight && prof.heightCm) { const base = evalStatus(bmiOf(data.weight, prof.heightCm), bandFor("bmi")); const toGoal = +(data.weight - data.targetWeight).toFixed(1); const range = healthyRange(prof.heightCm); let detail = toGoal > 0 ? `${toGoal}kg to your ${data.targetWeight}kg goal` : toGoal < 0 ? `${Math.abs(toGoal)}kg below goal` : "At your goal"; detail += ` · healthy ${range.min}–${range.max}kg`; weightStatus = base ? { ...base, detail, pos: (data.weight - range.min) / (range.max - range.min) } : null; }
  const Section = ({ t }) => <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "6px 2px 12px" }}>{t}</div>;
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ ...sheet, height: "90vh" }}>
    <Head title="Progress" onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
      <Section t="Weight & calories" />
      <Plot data={wd} color={C.violet} label="Weight" unit="kg" goalLine={data.targetWeight} status={weightStatus} />
      <Plot data={cd} color={C.coral} label="Daily calories" unit="" goalLine={data.calorieGoal} />
      <Section t="Body composition" />
      {bDays.length === 0 ? <div style={{ ...card, padding: 18, textAlign: "center", color: C.faint, fontSize: 13, marginBottom: 14 }}>No body readings yet — log them in the Body tab.</div>
        : BF.map(([k, label, unit, col]) => { const s = seriesFor(k); if (!s.length) return null; const st = evalStatus(s[s.length - 1].value, bandFor(k, prof.sex, prof.age), unit.trim()); return <Plot key={k} data={s} color={col} label={label} unit={unit} status={st} />; })}
      {bDays.length > 0 && <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.5, marginBottom: 14 }}>Status badges use general adult reference ranges, informational only — not a diagnosis.</div>}
      <Section t="Daily log" />
      {days.slice().reverse().map(k => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 2px", borderBottom: `1px solid ${C.stroke}`, fontSize: 13 }}><span style={{ color: C.ink, fontWeight: 600 }}>{fmt(k)}</span><span style={{ color: C.soft }}>{history[k].calories || 0} kcal · {history[k].weight || "—"}kg · {history[k].steps || 0} 👟</span></div>)}
      {!days.length && <div style={{ textAlign: "center", color: C.faint, padding: 22 }}>No history yet</div>}
    </div>
  </div></div>;
}

function Journal({ photos, onAdd, onRemove, onClose }) {
  const [loading, setLoading] = useState(false);
  const onPhoto = async (e) => { const f = e.target.files?.[0]; if (!f) return; setLoading(true); try { const b64 = await fileToB64(f); onAdd({ id: Date.now(), date: todayKey(), src: `data:image/jpeg;base64,${b64}` }); } catch {} finally { setLoading(false); e.target.value = ""; } };
  const sorted = [...photos].sort((a, b) => b.id - a.id);
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={sheet}>
    <Head title="Journal" onClose={onClose} />
    <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.stroke}` }}><PhotoBtns onPhoto={onPhoto} idns="jr" /><div style={{ fontSize: 11, color: C.faint, marginTop: 9, textAlign: "center" }}>{loading ? "Saving…" : "A photo a week tells the story"}</div></div>
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>{sorted.length === 0 && <div style={{ textAlign: "center", color: C.faint, fontSize: 14, marginTop: 24 }}>No photos yet</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{sorted.map(p => <div key={p.id} style={{ position: "relative" }}><img src={p.src} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", borderRadius: 16, border: `1px solid ${C.stroke}` }} /><div style={{ fontSize: 11, color: C.soft, marginTop: 6 }}>{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div><div onClick={() => onRemove(p.id)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(8,9,18,0.7)", color: "#fff", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>✕</div></div>)}</div>
    </div>
  </div></div>;
}

function Chat({ data, onClose }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hey — ask me anything about meals, movement, or hitting your goal by your target date." }]);
  const [input, setInput] = useState(""), [loading, setLoading] = useState(false), bottomRef = useRef();
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const send = async () => { if (!input.trim() || loading) return; const u = input.trim(); setInput(""); setMessages(m => [...m, { role: "user", text: u }]); setLoading(true);
    try { const ctx = `User today: ${data.caloriesEaten}/${data.budget} kcal, burned ${data.burned}, steps ${data.steps}, weight ${data.weight}kg (goal ${data.targetWeight}kg by ${data.targetDate}), sleep ${data.sleepHours}h, water ${data.water}/${data.waterGoal}. Warm, concise, encouraging. Not a doctor.`;
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ max_tokens: 1000, system: ctx, messages: [...messages.slice(1).map(m => ({ role: m.role, content: m.text })), { role: "user", content: u }] }) });
      const json = await res.json(); setMessages(m => [...m, { role: "assistant", text: json.content?.find(b => b.type === "text")?.text || "Try again?" }]); } catch { setMessages(m => [...m, { role: "assistant", text: "Connection issue — try again." }]); } setLoading(false);
  };
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ ...sheet, height: "80vh" }}>
    <Head title="Coach" onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>{messages.map((m, i) => <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%", background: m.role === "user" ? grad : C.glass, border: m.role === "user" ? "none" : `1px solid ${C.stroke}`, color: m.role === "user" ? "#fff" : C.ink, padding: "11px 14px", borderRadius: 18, fontSize: 14.5, lineHeight: 1.5 }}>{m.text}</div>)}{loading && <div style={{ color: C.faint, fontSize: 13 }}>…</div>}<div ref={bottomRef} /></div>
    <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.stroke}`, display: "flex", gap: 10, alignItems: "center" }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message…" style={{ flex: 1, background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 99, padding: "11px 16px", fontSize: 15, outline: "none", color: C.ink, fontFamily: FONT }} /><button onClick={send} style={{ border: "none", background: grad, color: "#fff", width: 42, height: 42, borderRadius: "50%", fontSize: 18, cursor: "pointer" }}>→</button></div>
  </div></div>;
}

function ScoreInfo({ score, onCelebrate, onClose }) {
  const rows = [["🍎", "Calories within budget", 18], ["🏃", "Exercise", 16], ["😊", "Mood logged", 16], ["😴", "Sleep", 14], ["💧", "Water", 14], ["👟", "Steps", 12], ["⚖️", "Weight logged", 10]];
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ ...sheet, height: "auto", maxHeight: "84vh" }}>
    <Head title="Your Loop Score" onClose={onClose} />
    <div style={{ padding: "22px 20px", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}><Ring score={score} /></div>
      {score >= 80 && <div style={{ textAlign: "center", marginBottom: 14, fontSize: 15, fontWeight: 700, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🎉 Loop closed — beautifully balanced day!</div>}
      {onCelebrate && <button onClick={onCelebrate} style={{ display: "block", margin: "0 auto 16px", border: `1px solid ${C.stroke}`, background: C.glass, color: C.violet, borderRadius: 99, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>🎊 Surprise me</button>}
      <p style={{ fontSize: 14.5, color: C.soft, lineHeight: 1.6, textAlign: "center", marginBottom: 18 }}>One number for how balanced your day was — across every habit, not just calories. Close the loop at 80 for a little celebration.</p>
      {rows.map(([e, l, p]) => <div key={l} style={{ ...card, display: "flex", alignItems: "center", padding: "12px 14px", marginBottom: 8, fontSize: 14 }}><span style={{ fontSize: 17, marginRight: 12 }}>{e}</span><span style={{ flex: 1, color: C.ink }}>{l}</span><span style={{ fontWeight: 700, color: C.violet }}>{p}</span></div>)}
      <p style={{ fontSize: 11, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>A motivational guide for balance — not a medical measurement.</p>
    </div>
  </div></div>;
}

function Profile({ data, history, streak, account, theme, onToggleTheme, onLogin, onLogout, onEditGoals, onToggleSound, onReset, onOpenDoc, onClose }) {
  const p = data.profile || {}, start = p.weightKg, now = data.weight || p.weightKg, lost = +((start || 0) - (now || 0)).toFixed(1);
  const range = p.heightCm ? healthyRange(p.heightCm) : null, bmi = (now && p.heightCm) ? bmiOf(now, p.heightCm).toFixed(1) : "—";
  const initials = account?.name ? account.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() : null;
  const row = (l, v) => <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.stroke}`, fontSize: 14 }}><span style={{ color: C.soft }}>{l}</span><span style={{ color: C.ink, fontWeight: 600 }}>{v}</span></div>;
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={sheet}>
    <Head title="Profile" onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ width: 76, height: 76, borderRadius: "50%", background: grad, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: initials ? 26 : 32, fontWeight: 800, color: "#fff", boxShadow: `0 8px 28px ${C.violet}55` }}>{initials || "◎"}</div>
        {account ? <><div style={{ marginTop: 10, fontSize: 17, fontWeight: 700, color: C.ink }}>{account.name}</div><div style={{ fontSize: 12.5, color: C.soft }}>{account.email}</div></> : <div style={{ marginTop: 10, fontSize: 13, color: C.soft }}>Not signed in</div>}
        <div style={{ marginTop: 6, fontSize: 13, color: C.soft }}>🔥 {streak}-day streak · {Object.keys(history).length} days logged</div>
        {!account && <button onClick={onLogin} style={{ marginTop: 12, border: "none", background: grad, color: "#fff", borderRadius: 99, padding: "10px 24px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Sign in / Sign up</button>}
      </div>
      <div style={{ ...card, padding: "4px 16px", marginBottom: 14 }}>{account && row("Account", account.email)}{row("Sex", p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : "—")}{row("Age", p.age ? p.age + " yrs" : "—")}{row("Height", p.heightCm ? p.heightCm + " cm" : "—")}{row("Current weight", now ? now + " kg" : "—")}{row("BMI", bmi)}{row("Activity", p.activity ? p.activity[0].toUpperCase() + p.activity.slice(1) : "—")}</div>
      <div style={{ ...card, padding: "4px 16px", marginBottom: 16 }}>{row("Start weight", start ? start + " kg" : "—")}{row("Goal", data.targetWeight + " kg")}{row("Lost so far", lost > 0 ? lost + " kg 🎉" : "—")}{row("Target date", data.targetDate ? new Date(data.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—")}{row("Daily target", data.calorieGoal + " kcal")}{range && row("Healthy range", `${range.min}–${range.max} kg`)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onEditGoals} style={{ border: "none", background: grad, color: "#fff", borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Edit goals & date</button>
        <button onClick={onToggleTheme} style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: C.violet, borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{theme === "dark" ? "🌙 Appearance · Dark" : "☀️ Appearance · Light"}</button>
        <button onClick={onToggleSound} style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: data.soundOn ? C.cyan : C.faint, borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{data.soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button>
        {account && <button onClick={onLogout} style={{ border: `1px solid ${C.stroke}`, background: C.glass, color: C.soft, borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Sign out</button>}
        <button onClick={onReset} style={{ border: `1px solid ${C.coral}44`, background: C.glass, color: C.coral, borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Reset all data</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        <span onClick={() => onOpenDoc("how")} style={{ fontSize: 12, color: C.soft, cursor: "pointer" }}>📖 How it works</span>
        <span onClick={() => onOpenDoc("privacy")} style={{ fontSize: 12, color: C.soft, cursor: "pointer" }}>🔒 Privacy</span>
        <span onClick={() => onOpenDoc("terms")} style={{ fontSize: 12, color: C.soft, cursor: "pointer" }}>📄 Terms</span>
      </div>
      <div style={{ textAlign: "center", marginTop: 22 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline-block" }}>Made by LeaLora 🌱</div>
        <div style={{ fontSize: 11, color: C.soft, marginTop: 3, fontStyle: "italic" }}>a work in progress, for works in progress</div>
        <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2, letterSpacing: "0.1em" }}>2026</div>
      </div>
      <p style={{ fontSize: 11, color: C.faint, marginTop: 18, lineHeight: 1.5, textAlign: "center" }}>Loop is a wellness companion, not a medical service. Figures are estimates — consult a doctor or dietitian for personal advice.</p>
    </div>
  </div></div>;
}
function Login({ onAuth, onClose }) {
  const [mode, setMode] = useState("signin"), [name, setName] = useState(""), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState("");
  const valid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const submit = () => { if (mode === "signup" && !name.trim()) { setErr("Please enter your name."); return; } if (!valid(email)) { setErr("Please enter a valid email."); return; } if (pw.length < 6) { setErr("Password must be 6+ characters."); return; } sound.add(); onAuth({ name: name.trim() || email.split("@")[0], email: email.trim().toLowerCase() }); };
  const inp = { width: "100%", background: C.glass, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "13px 14px", fontSize: 15, fontFamily: FONT, outline: "none", color: C.ink, marginBottom: 14 };
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ ...sheet, height: "auto", maxHeight: "88vh" }}>
    <Head title={mode === "signin" ? "Welcome back" : "Create account"} onClose={onClose} />
    <div style={{ padding: "20px", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, background: C.glass, borderRadius: 99, padding: 4, border: `1px solid ${C.stroke}` }}>{[["signin", "Sign in"], ["signup", "Sign up"]].map(([m, l]) => <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, border: "none", background: mode === m ? grad : "transparent", color: mode === m ? "#fff" : C.soft, padding: "10px", fontWeight: 700, fontSize: 13, borderRadius: 99, cursor: "pointer", fontFamily: FONT }}>{l}</button>)}</div>
      {mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />}
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" style={inp} />
      <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="Password" style={inp} />
      {err && <div style={{ fontSize: 12.5, color: C.coral, marginBottom: 10, fontWeight: 600 }}>{err}</div>}
      <button onClick={submit} style={{ width: "100%", border: "none", background: grad, color: "#fff", borderRadius: 14, padding: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, boxShadow: `0 8px 24px ${C.violet}44` }}>{mode === "signin" ? "Sign in" : "Create account"}</button>
      <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.5, marginTop: 16, textAlign: "center" }}>Demo sign-in: details are stored privately on this device only. A published app would use a secure backend.</div>
    </div>
  </div></div>;
}

function Docs({ which, onClose }) {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const H = ({ children }) => <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: "18px 0 8px", letterSpacing: "0.02em" }}>{children}</div>;
  const P = ({ children }) => <p style={{ fontSize: 13.5, color: C.soft, lineHeight: 1.65, marginBottom: 10 }}>{children}</p>;
  const title = which === "privacy" ? "Privacy Policy" : which === "terms" ? "Terms of Service" : "How Loop works";
  return <div style={sheetWrap} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ ...sheet, height: "90vh" }}>
    <Head title={title} onClose={onClose} />
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 40px" }}>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 6 }}>Last updated · {today}</div>

      {which === "privacy" && <>
        <P>This is a template privacy policy for Loop. Before publishing, replace the bracketed placeholders and have it reviewed by a qualified professional for your jurisdiction (Singapore PDPA, EU GDPR, Apple and Google requirements).</P>
        <H>Who we are</H>
        <P>Loop ("the app", "we") is operated by [Your name / company], contactable at [your email]. We are the data controller for information processed by the app.</P>
        <H>What we store</H>
        <P>In this version, the information you enter — such as your profile details, daily logs, photos, and preferences — is saved on your device and, when you are signed in, synced to your private cloud account (hosted on Supabase) so it is available on your other devices and backed up. Only you can read your rows. You can delete your data at any time from Profile.</P>
        <H>AI features</H>
        <P>Some optional features send the text or image you provide (for example, a food description or photo) to our AI provider to generate an estimate or response. Send only what you are comfortable sharing. [Name your AI provider and link their privacy terms.]</P>
        <H>What we do not do</H>
        <P>We do not sell your information. We do not show third-party advertising. We do not track you across other apps or websites.</P>
        <H>Your choices</H>
        <P>You can edit or delete your data at any time from within the app, including a full reset that clears everything stored on your device. Removing the app also removes its local data.</P>
        <H>Children</H>
        <P>Loop is not intended for children under [age]. We do not knowingly collect information from them.</P>
        <H>Changes & contact</H>
        <P>We may update this policy and will revise the date above when we do. Questions: [your email].</P>
      </>}

      {which === "terms" && <>
        <P>This is a template terms-of-service for Loop. Replace the placeholders and have it reviewed by a qualified professional before publishing.</P>
        <H>Acceptance</H>
        <P>By using Loop you agree to these terms. If you do not agree, please do not use the app.</P>
        <H>Not medical advice</H>
        <P>Loop is a general wellness and self-tracking tool. It does not provide medical, nutritional, or psychological advice, diagnosis, or treatment, and is not a substitute for a qualified professional. Any figures, estimates, or suggestions are general and may not suit your circumstances. Always consult a doctor or registered dietitian before changing how you eat or exercise, and seek professional help for any health concern.</P>
        <H>Estimates</H>
        <P>Figures shown in the app are approximate and based on standard population formulas and AI estimates. They will not be exact for any individual and should be treated as rough guidance only.</P>
        <H>Your responsibilities</H>
        <P>You are responsible for the information you enter and for how you use the app. Use it in a way that supports your wellbeing, and stop and seek support if it is not serving you.</P>
        <H>Availability & changes</H>
        <P>We may change, suspend, or discontinue features at any time. We aim to keep the app working but provide it "as is" without warranties of uninterrupted or error-free operation.</P>
        <H>Limitation of liability</H>
        <P>To the extent permitted by law, [Your name / company] is not liable for any loss arising from use of the app. [Insert jurisdiction-appropriate limitation reviewed by a professional.]</P>
        <H>Governing law & contact</H>
        <P>These terms are governed by the laws of [your jurisdiction, e.g. Singapore]. Questions: [your email].</P>
      </>}

      {which === "how" && <>
        <P>Loop aims to be transparent about where its estimates come from, and the sources behind them.</P>
        <H>Energy needs</H>
        <P>Loop estimates your resting energy use with the Mifflin–St Jeor equation, a widely cited standard in dietetics, then applies a standard activity multiplier to estimate daily maintenance energy. These are population averages — real needs vary with genetics, body composition, and daily movement.</P>
        <H>Your daily target</H>
        <P>Your target is your estimated maintenance energy minus a moderate reduction. Loop keeps a safe minimum and a steady, gentle pace, and will not recommend going below that minimum. If a chosen date would require a faster pace than is safe, Loop keeps the safe target and shows a realistic projected date instead, rather than displaying a date the safe plan cannot reach.</P>
        <H>Projected timing</H>
        <P>Timing uses the common approximation relating energy to body mass. Because energy needs change over time, real-world progress is usually a little slower than a simple projection, so dates are estimates, not guarantees.</P>
        <H>Body composition</H>
        <P>Readings you enter from a smart scale are interpreted against general adult reference ranges for information only. Such devices estimate via bioelectrical impedance, which shifts with hydration and time of day, so treat them as trends, not precise measurements.</P>
        <H>Wellbeing score</H>
        <P>The daily score is a simple weighted blend of your logged habits, designed as a gentle motivational guide toward balance across the day — not a clinical measurement.</P>
        <H>References</H>
        <P>Mifflin MD, St Jeor ST, et al. "A new predictive equation for resting energy expenditure in healthy individuals." American Journal of Clinical Nutrition, 1990. General dietary reference values from recognised public-health bodies. For personal guidance, a registered dietitian or doctor can tailor these to you.</P>
        <P style={{ marginTop: 14, color: C.faint, fontSize: 12 }}>Loop is a wellness companion, not a medical service.</P>
      </>}
    </div>
  </div></div>;
}

function Tile({ label, value, sub, accent, icon, open, expanded, children }) {
  return <div onClick={open} style={{ ...card, padding: 16, cursor: "pointer", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: -30, right: -30, width: 80, height: 80, borderRadius: "50%", background: accent, opacity: 0.12, filter: "blur(8px)" }} />
    <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
    <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontFamily: FONT, fontSize: 23, fontWeight: 800, color: C.ink, marginTop: 2 }}>{value}{sub && <span style={{ fontSize: 12, color: C.faint, fontWeight: 500, marginLeft: 4 }}>{sub}</span>}</div>
    {expanded && <div onClick={e => e.stopPropagation()} style={{ marginTop: 14 }}>{children}</div>}
  </div>;
}

export default function Loop({ account: authAccount = null, onLogout = null }) {
  const [loaded, setLoaded] = useState(false), [setupDone, setSetupDone] = useState(false);
  const [data, setData] = useState({ calorieGoal: 1800, tdee: 0, deficit: 0, targetWeight: 53, targetDate: null, profile: null, deductBurned: true, soundOn: true, exercise: 0, exerciseGoal: 30, exerciseMode: "minutes", exerciseBurn: 0, steps: 0, stepGoal: 8000, weight: 0, mood: -1, sleepHours: 0, sleepGoal: 8, water: 0, waterGoal: 8 });
  const [foods, setFoods] = useState([]), [favourites, setFavourites] = useState([]), [photos, setPhotos] = useState([]), [history, setHistory] = useState({}), [bodyLog, setBodyLog] = useState({}), [account, setAccount] = useState(null);
  const [modal, setModal] = useState(null), [active, setActive] = useState(null);
  const [docWhich, setDocWhich] = useState("how");
  const [theme, setTheme] = useState("dark");
  applyTheme(theme);

  useEffect(() => { (async () => {
    const cfg = await store.get("loop_config", null), hist = await store.get("loop_history", {}), favs = await store.get("loop_fav", []), pics = await store.get("loop_photos", []), bl = await store.get("loop_body", {}), acc = authAccount || await store.get("loop_account", null), td = await store.get("loop_today:" + todayKey(), null);
    if (cfg) { setData(d => ({ ...d, ...cfg })); setSetupDone(true); sound.on = cfg.soundOn !== false; if (cfg.theme) { setTheme(cfg.theme); applyTheme(cfg.theme); } }
    setHistory(hist); setFavourites(favs); setPhotos(pics); setBodyLog(bl); setAccount(acc);
    if (td) { setData(d => ({ ...d, ...cfg, ...td.data })); setFoods(td.foods || []); }
    setLoaded(true);
  })(); }, []);

  const caloriesEaten = foods.reduce((s, e) => s + (e.calories || 0), 0);
  const burned = calcBurned(data.steps, data.exercise, data.exerciseBurn, data.exerciseMode, data.weight);
  const budget = data.calorieGoal + (data.deductBurned ? burned : 0);
  const remaining = budget - caloriesEaten;
  const macroGoals = macroTargets(data.targetWeight, data.calorieGoal);
  const update = (k, v) => setData(d => ({ ...d, [k]: v }));
  const streak = (() => { const h = { ...history, [todayKey()]: { calories: caloriesEaten } }; let n = 0; const d = new Date(); for (;;) { const k = d.toISOString().slice(0, 10); if (h[k] && h[k].calories > 0) { n++; d.setDate(d.getDate() - 1); } else break; } return n; })();

  useEffect(() => { if (!setupDone || !data.profile || !data.targetDate || !data.weight) return; const p = calcPlan(data.profile, data.weight, data.targetWeight, data.targetDate); if (p.goal !== data.calorieGoal) setData(d => ({ ...d, calorieGoal: p.goal, tdee: p.tdee, deficit: p.deficit })); }, [data.weight, data.targetWeight, data.targetDate, setupDone]);
  useEffect(() => { if (!loaded || !setupDone) return; (async () => { await store.set("loop_today:" + todayKey(), { data, foods }); const nh = { ...history, [todayKey()]: { calories: caloriesEaten, weight: data.weight || null, steps: data.steps, exercise: data.exercise, calorieGoal: data.calorieGoal } }; setHistory(nh); await store.set("loop_history", nh); })(); }, [data, foods, loaded, setupDone]);

  const saveFavs = async (n) => { setFavourites(n); await store.set("loop_fav", n); };
  const savePhotos = async (n) => { setPhotos(n); await store.set("loop_photos", n); };
  const toggleFav = (e) => { const ex = favourites.some(f => f.name === e.name); saveFavs(ex ? favourites.filter(f => f.name !== e.name) : [...favourites, { name: e.name, calories: e.calories, protein: e.protein || 0, fat: e.fat || 0, fibre: e.fibre || 0, sugar: e.sugar || 0, netCarbs: e.netCarbs || 0 }]); };
  const saveBody = async (en) => { const n = { ...bodyLog, [en.date]: { vals: en.vals, analysis: en.analysis } }; setBodyLog(n); await store.set("loop_body", n); };
  const toggleDeduct = async () => { const v = !data.deductBurned; setData(d => ({ ...d, deductBurned: v })); const c = await store.get("loop_config", {}); await store.set("loop_config", { ...c, deductBurned: v }); };
  const toggleSound = async () => { const v = !data.soundOn; sound.on = v; setData(d => ({ ...d, soundOn: v })); if (v) sound.tap(); const c = await store.get("loop_config", {}); await store.set("loop_config", { ...c, soundOn: v }); };
  const toggleTheme = async () => { const v = theme === "dark" ? "light" : "dark"; setTheme(v); applyTheme(v); sound.tap(); const c = await store.get("loop_config", {}); await store.set("loop_config", { ...c, theme: v }); };
  const resetAll = async () => { if (!window.confirm("Reset all data? This cannot be undone.")) return; try { const ks = await window.storage.list(); (ks?.keys || []).filter(k => k.startsWith("loop_")).forEach(k => window.storage.delete(k)); } catch {} setModal(null); setSetupDone(false); setFoods([]); setFavourites([]); setPhotos([]); setHistory({}); setBodyLog({}); if (!authAccount) setAccount(null); };
  const doLogin = async (acc) => { setAccount(acc); await store.set("loop_account", acc); setModal("profile"); };
  const doLogout = async () => { if (onLogout) return onLogout(); setAccount(null); try { window.storage.delete("loop_account"); } catch {} };
  const open = (m) => { sound.tap(); setModal(m); };

  const score = Math.round(Math.min(caloriesEaten / budget, 1) * 18 + Math.min(data.exercise / data.exerciseGoal, 1) * 16 + Math.min(data.steps / data.stepGoal, 1) * 12 + (data.weight > 0 ? 10 : 0) + (data.mood >= 0 ? ((data.mood + 1) / 5) * 16 : 0) + Math.min(data.sleepHours / data.sleepGoal, 1) * 14 + Math.min(data.water / data.waterGoal, 1) * 14);
  const [celebrate, setCelebrate] = useState(0);
  const [fxIndex, setFxIndex] = useState(0);
  const wasHigh = useRef(false);
  useEffect(() => { const high = score >= 80; if (high && !wasHigh.current) { sound.win(); setFxIndex(Math.floor(Math.random() * EFFECTS.length)); setCelebrate(c => c + 1); } wasHigh.current = high; }, [score >= 80]);

  const FONTCSS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');`;
  if (!loaded) return <div style={{ minHeight: "100vh", background: C.bg0, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontFamily: FONT }}><style>{FONTCSS}</style>Loading…</div>;
  if (!setupDone) return <><style>{`${FONTCSS}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:${FONT};background:${C.bg0};}`}</style><Setup initial={data.profile} onDone={async (cfg) => { setData(d => ({ ...d, ...cfg })); await store.set("loop_config", { calorieGoal: cfg.calorieGoal, tdee: cfg.tdee, deficit: cfg.deficit, targetWeight: cfg.targetWeight, targetDate: cfg.targetDate, weight: cfg.weight, profile: cfg.profile, deductBurned: data.deductBurned, soundOn: data.soundOn, theme }); setSetupDone(true); }} /></>;

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const toGo = +(data.weight - data.targetWeight).toFixed(1);
  const daysLeft = data.targetDate ? Math.max(0, Math.ceil((new Date(data.targetDate) - new Date()) / 86400000)) : null;
  const nav = [["food", "🍎", "Food"], ["journal", "📸", "Journal"], ["body", "⚗️", "Body"], ["history", "📈", "Progress"], ["ai", "💬", "Coach"]];

  return <div>
    <style>{`${FONTCSS}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:${FONT};color:${C.ink};background:${C.bg0};}input::placeholder{color:${C.faint};}::-webkit-scrollbar{width:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}.fu{animation:fadeUp .4s ease forwards;}input:focus{border-color:${C.violet} !important;}`}</style>

    <div style={{ minHeight: "100vh", background: C.appBg, transition: "background .4s ease" }}>
      <div className="fu" style={{ maxWidth: 470, margin: "0 auto", padding: "0 18px 110px" }}>
        <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 38px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Loop</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{today}</div>
          </div>
          <div onClick={() => open("profile")} style={{ width: 42, height: 42, borderRadius: "50%", background: account ? grad : C.glass, border: `1px solid ${C.stroke}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: account ? "#fff" : C.soft, cursor: "pointer" }}>{account?.name ? account.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() : "◎"}</div>
        </div>

        <div onClick={() => open("score")} style={{ ...card, padding: 20, marginTop: 18, display: "flex", alignItems: "center", gap: 18, cursor: "pointer" }}>
          <Ring score={score} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: C.soft, marginBottom: 10 }}>{toGo > 0 ? <>{toGo}kg to goal{daysLeft != null && <> · {daysLeft} days</>}</> : "Goal reached 🎉"}</div>
            <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 4 }}>🔥 {streak}-day streak</div>
            <div style={{ fontSize: 12, color: C.faint }}>Tap to see your score breakdown</div>
          </div>
        </div>

        <div onClick={() => open("food")} style={{ ...card, padding: 20, marginTop: 14, cursor: "pointer", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -20, width: 120, height: 120, borderRadius: "50%", background: grad, opacity: 0.16, filter: "blur(20px)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <div><div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Eaten</div><div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{caloriesEaten}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{remaining >= 0 ? "Left" : "Over"}</div><div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 800, lineHeight: 1, color: remaining >= 0 ? C.lime : C.coral }}>{Math.abs(remaining)}</div></div>
          </div>
          <Bar value={caloriesEaten} max={budget} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: C.faint }}>Budget {budget} kcal</span>
            <span onClick={e => { e.stopPropagation(); sound.tap(); toggleDeduct(); }} style={{ fontSize: 12, color: C.soft, cursor: "pointer", borderBottom: `1px solid ${data.deductBurned ? C.cyan : C.stroke}` }}>Burned {burned} · {data.deductBurned ? "counted" : "off"}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <Tile label="Exercise" icon="🏃" accent={C.exercise} value={data.exerciseMode === "kcal" ? data.exerciseBurn : data.exercise} sub={data.exerciseMode === "kcal" ? "kcal" : "min"} open={() => setActive(active === "ex" ? null : "ex")} expanded={active === "ex"}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{["minutes", "kcal"].map(m => <button key={m} onClick={() => update("exerciseMode", m)} style={{ flex: 1, border: `1px solid ${data.exerciseMode === m ? "transparent" : C.stroke}`, background: data.exerciseMode === m ? grad : C.glass, color: data.exerciseMode === m ? "#fff" : C.soft, padding: "7px 0", fontSize: 11, fontWeight: 600, borderRadius: 10, cursor: "pointer", fontFamily: FONT }}>{m}</button>)}</div>
            {data.exerciseMode === "minutes" ? <Field value={data.exercise} onChange={v => update("exercise", v)} placeholder="0" suffix="min" /> : <Field value={data.exerciseBurn} onChange={v => update("exerciseBurn", v)} placeholder="0" suffix="kcal" />}
          </Tile>
          <Tile label="Steps" icon="👟" accent={C.steps} value={data.steps.toLocaleString()} sub={`${stepsKcal(data.steps, data.weight)} kcal`} open={() => setActive(active === "st" ? null : "st")} expanded={active === "st"}>
            <Field value={data.steps} onChange={v => update("steps", v)} placeholder="0" suffix="steps" />
          </Tile>
          <Tile label="Weight" icon="⚖️" accent={C.weight} value={data.weight > 0 ? data.weight : "—"} sub={data.weight > 0 ? "kg" : ""} open={() => setActive(active === "wt" ? null : "wt")} expanded={active === "wt"}>
            <Field value={data.weight} onChange={v => update("weight", v)} placeholder="0" suffix="kg" />
          </Tile>
          <Tile label="Mood" icon={data.mood >= 0 ? MOODS[data.mood] : "🙂"} accent={C.mood} value={data.mood >= 0 ? MOOD_LABELS[data.mood] : "—"} open={() => setActive(active === "md" ? null : "md")} expanded={active === "md"}>
            <div style={{ display: "flex", gap: 6 }}>{MOODS.map((m, i) => <button key={i} onClick={() => { update("mood", i); sound.tap(); }} style={{ flex: 1, border: `1px solid ${data.mood === i ? "transparent" : C.stroke}`, background: data.mood === i ? grad : C.glass, padding: "9px 0", fontSize: 16, cursor: "pointer", borderRadius: 10 }}>{m}</button>)}</div>
          </Tile>
          <Tile label="Sleep" icon="😴" accent={C.sleep} value={data.sleepHours} sub={`/ ${data.sleepGoal}h`} open={() => setActive(active === "sl" ? null : "sl")} expanded={active === "sl"}>
            <Field value={data.sleepHours} onChange={v => update("sleepHours", v)} placeholder="0" suffix="hrs" />
          </Tile>
          <Tile label="Water" icon="🥛" accent={C.water} value={data.water} sub={`/ ${data.waterGoal} glasses`} open={() => setActive(active === "wa" ? null : "wa")} expanded={active === "wa"}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Array.from({ length: data.waterGoal }).map((_, i) => <Glass key={i} filled={i < data.water} onClick={() => { update("water", i < data.water ? i : i + 1); sound.tap(); }} />)}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Tap a glass — about 250 ml each</div>
          </Tile>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 26, fontSize: 12, color: C.soft }}>
          <span onClick={() => { sound.tap(); setSetupDone(false); }} style={{ cursor: "pointer" }}>⚙️ Goals</span>
          <span onClick={toggleTheme} style={{ cursor: "pointer" }}>{theme === "dark" ? "🌙 Dark" : "☀️ Light"}</span>
          <span onClick={toggleSound} style={{ cursor: "pointer", color: data.soundOn ? C.cyan : C.faint }}>{data.soundOn ? "🔊 Sound" : "🔇 Muted"}</span>
        </div>
      </div>
    </div>

    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 470, background: C.navBg, backdropFilter: "blur(20px)", borderTop: `1px solid ${C.stroke}`, display: "flex", zIndex: 200 }}>
      {nav.map(([m, icon, l]) => <button key={m} onClick={() => open(m)} style={{ flex: 1, border: "none", background: "transparent", color: C.soft, padding: "12px 0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><span style={{ fontSize: 19 }}>{icon}</span>{l}</button>)}
    </div>

    {modal === "food" && <FoodLog goal={budget} macroGoals={macroGoals} entries={foods} favourites={favourites} onAdd={f => { sound.add(); setFoods(p => [...p, f]); }} onRemove={id => setFoods(p => p.filter(e => e.id !== id))} onToggleFav={toggleFav} onClose={() => setModal(null)} />}
    {modal === "journal" && <Journal photos={photos} onAdd={p => savePhotos([...photos, p])} onRemove={id => savePhotos(photos.filter(x => x.id !== id))} onClose={() => setModal(null)} />}
    {modal === "body" && <BodyComp onSaveEntry={saveBody} onClose={() => setModal(null)} />}
    {modal === "history" && <Progress history={history} bodyLog={bodyLog} data={data} onClose={() => setModal(null)} />}
    {modal === "ai" && <Chat data={{ ...data, caloriesEaten, budget, burned }} onClose={() => setModal(null)} />}
    {modal === "score" && <ScoreInfo score={score} onCelebrate={() => { sound.win(); setFxIndex(Math.floor(Math.random() * EFFECTS.length)); setCelebrate(c => c + 1); }} onClose={() => setModal(null)} />}
    {modal === "profile" && <Profile data={data} history={history} streak={streak} account={account} theme={theme} onToggleTheme={toggleTheme} onLogin={() => setModal("login")} onLogout={doLogout} onEditGoals={() => { setModal(null); setSetupDone(false); }} onToggleSound={toggleSound} onReset={resetAll} onOpenDoc={(w) => { setDocWhich(w); setModal("docs"); }} onClose={() => setModal(null)} />}
    {modal === "docs" && <Docs which={docWhich} onClose={() => setModal("profile")} />}
    {modal === "login" && <Login onAuth={doLogin} onClose={() => setModal("profile")} />}
    {celebrate > 0 && <Celebration key={celebrate} index={fxIndex} onDone={() => setCelebrate(0)} />}
  </div>;
}
