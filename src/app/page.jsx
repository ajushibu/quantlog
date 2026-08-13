"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { api, getCode, setCode, clearCode, fetchPhotoUrl } from "@/lib/api";
import { THEMES, THEME_KEY } from "@/lib/themes";
import { SECTIONS, ALL_ITEMS, ITEM_BY_ID, CLASSIFY_LIST } from "@/lib/syllabus";

const EXAM_DATE = new Date(2026, 10, 29);
const START_DATE = new Date(2026, 7, 11);
const TARGET = new Date(2026, 10, 8);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d) => {
  // local date, not UTC — otherwise activity before 5:30 AM IST logs to yesterday
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = () => Math.random().toString(36).slice(2, 10);
const daysBetween = (a, b) => Math.floor((b - new Date(a)) / 864e5);

const Icon = {
  check: (c, s = 11) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  bookmark: (c, s = 13) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.8L4 14V2.5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>),
  bookmarkFill: (c, s = 13) => (<svg width={s} height={s} viewBox="0 0 16 16"><path d="M4 2.5h8V14l-4-2.8L4 14V2.5z" fill={c} /></svg>),
  camera: (c, s = 14) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4" width="13" height="9.5" rx="2" stroke={c} strokeWidth="1.4" /><circle cx="8" cy="8.7" r="2.6" stroke={c} strokeWidth="1.4" /><path d="M5.5 4L6.5 2.5h3L10.5 4" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>),
  chevron: (open, c, s = 12) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M3.5 6L8 10.5L12.5 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  download: (c, s = 13) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 13.5h10" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  book: (c, s = 12) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2.5 3.5A1.5 1.5 0 014 2h9.5v11H4a1.5 1.5 0 00-1.5 1.5v-11z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" /><path d="M2.5 14.5A1.5 1.5 0 014 13h9.5" stroke={c} strokeWidth="1.4" /></svg>),
  palette: (c, s = 15) => (<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 1.5A6.5 6.5 0 108 14.5c1 0 1.4-.6 1.4-1.2 0-.5-.3-.8-.3-1.2 0-.6.5-1 1.1-1H11a3.5 3.5 0 003.5-3.5C14.5 4 11.6 1.5 8 1.5z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" /><circle cx="5" cy="7" r=".9" fill={c} /><circle cx="7.2" cy="4.6" r=".9" fill={c} /><circle cx="10.2" cy="5.2" r=".9" fill={c} /></svg>),
};

function defaultState() {
  return { settings: { revisionDays: [0] }, items: {}, flags: {}, log: [], digest: "", digestDate: "" };
}

const itemDone = (st, it) => { const v = st.items[it.id] || {}; return it.kind === "s" ? !!(v.l1 && v.l2) : !!v.v; };
const sectionStats = (st, s) => {
  const cls = s.items.filter((i) => i.kind !== "s");
  const sets = s.items.filter((i) => i.kind === "s");
  return {
    clsDone: cls.filter((i) => itemDone(st, i)).length, clsTotal: cls.length,
    setsDone: sets.filter((i) => itemDone(st, i)).length, setsTotal: sets.length,
    allDone: s.items.every((i) => itemDone(st, i)),
    pct: s.items.filter((i) => itemDone(st, i)).length / s.items.length,
  };
};
function streakDays(state) {
  const days = new Set(state.log.map((l) => l.date));
  let n = 0; const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function exportRevisionDoc(queue, flagged) {
  const parts = [];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    let imgTag = "";
    if (s.hasPhoto) {
      const url = await fetchPhotoUrl(s.id);
      if (url) {
        const blob = await (await fetch(url)).blob();
        const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
        imgTag = `<p><img src="${b64}" style="max-width:520px" /></p>`;
      }
    }
    parts.push(`<div style="page-break-inside:avoid; margin-bottom:36px;">
      <p style="font-size:11px; color:#666; letter-spacing:1px; margin:0 0 6px;"><b>Q${i + 1}</b> · ${ITEM_BY_ID[s.topicId]?.name || "General"} · filed ${s.date}${s.keepCount ? ` · kept ${s.keepCount}×` : ""}</p>
      ${s.text ? `<p style="font-size:14px; margin:0 0 8px;">${s.text.replace(/</g, "&lt;")}</p>` : ""}
      ${imgTag}<p style="color:#bbb; font-size:11px;">Working:</p><div style="height:140px; border:1px solid #ddd;"></div></div>`);
  }
  const flaggedHtml = flagged.length ? `<p style="font-size:12px;color:#444;"><b>Also revisit notes for:</b> ${flagged.map((id) => ITEM_BY_ID[id]?.name).filter(Boolean).join(", ")}</p><hr/>` : "";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Revision</title></head><body style="font-family:Georgia,serif;color:#111;padding:24px;">
    <h1 style="font-size:22px;margin-bottom:2px;">Weekly Revision Sheet</h1>
    <p style="font-size:12px;color:#666;margin-top:0;">${new Date().toDateString()} · ${queue.length} question${queue.length === 1 ? "" : "s"}</p>
    <hr/>${flaggedHtml}${parts.join("")}</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `revision-${dayKey(new Date())}.doc`; a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================ */
export default function App() {
  const [code, setCodeInput] = useState("");
  const [authed, setAuthed] = useState(null);
  const [state, setState] = useState(null);
  const [struggles, setStruggles] = useState([]);
  const [view, setView] = useState("study");
  const [themeKey, setThemeKey] = useState("ember");

  /* Debounced persistence: instant UI, one write per burst of changes.
     syncStatus: "" | "saving" | "saved" | "error" */
  const [syncStatus, setSyncStatus] = useState("");
  const saveTimer = useRef(null);
  const latestState = useRef(null);
  const flush = async () => {
    if (!latestState.current) return;
    const snapshot = latestState.current;
    setSyncStatus("saving");
    try {
      await api.putState(snapshot);
      if (latestState.current === snapshot) { setSyncStatus("saved"); setTimeout(() => setSyncStatus((s) => (s === "saved" ? "" : s)), 1500); }
    } catch (e) { console.error(e); setSyncStatus("error"); }
  };
  const persist = (next) => {
    setState(next);
    latestState.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 600);
  };
  useEffect(() => () => { clearTimeout(saveTimer.current); }, []);
  const [authErr, setAuthErr] = useState("");
  const now = new Date();
  const T = THEMES[themeKey];

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    if (saved && THEMES[saved]) setThemeKey(saved);
    const c = getCode();
    if (c) tryAuth(c); else setAuthed(false);
  }, []);

  /* When the app regains focus (switching from iPad to laptop, reopening the
     PWA), silently pull fresh data so the two devices don't drift. Skipped
     while a local save is pending so we never clobber unsent changes. */
  useEffect(() => {
    const onFocus = async () => {
      if (!getCode() || document.visibilityState !== "visible") return;
      if (latestState.current && syncStatus === "saving") return;
      try {
        const s = await api.getState();
        const g = await api.listStruggles();
        if (!saveTimer.current || syncStatus !== "saving") {
          setState((prev) => ({ ...defaultState(), ...(s || {}) }));
          setStruggles(g.struggles.map((r) => ({
            id: r.id, text: r.text_body, topicId: r.topic_id, date: r.filed_on,
            answerText: r.answer_text, hasPhoto: r.has_photo, hasAnsPhoto: r.has_ans_photo,
            retired: r.retired, lastTried: r.last_tried, keepCount: r.keep_count,
          })));
        }
      } catch { /* offline — keep local view */ }
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [syncStatus]);

  /* keep the browser / PWA status bar color matched to the active theme */
  useEffect(() => {
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.content = THEMES[themeKey].card;
  }, [themeKey]);

  async function tryAuth(c) {
    setCode(c);
    try {
      const s = await api.getState();
      const g = await api.listStruggles();
      setState({ ...defaultState(), ...(s || {}) });
      setStruggles(g.struggles.map((r) => ({
        id: r.id, text: r.text_body, topicId: r.topic_id, date: r.filed_on,
        answerText: r.answer_text, hasPhoto: r.has_photo, hasAnsPhoto: r.has_ans_photo,
        retired: r.retired, lastTried: r.last_tried, keepCount: r.keep_count,
      })));
      setAuthed(true); setAuthErr("");
    } catch (e) {
      clearCode(); setAuthed(false);
      setAuthErr(e.code === 401 ? "That code didn't work." : "Couldn't reach the server. Check your connection.");
    }
  }



  const chooseTheme = (k) => { setThemeKey(k); localStorage.setItem(THEME_KEY, k); };

  if (authed === null) return <Splash T={T} text="Loading" />;
  if (!authed) return <Login code={code} setCodeInput={setCodeInput} onSubmit={() => tryAuth(code)} err={authErr} T={T} />;
  if (!state) return <Splash T={T} text="Loading your data" />;

  const total = ALL_ITEMS.length;
  const done = ALL_ITEMS.filter((i) => itemDone(state, i)).length;
  const queueN = struggles.filter((s) => !s.retired).length;
  const daysToExam = Math.max(0, Math.ceil((EXAM_DATE - now) / 864e5));

  return (
    <div style={{ minHeight: "100vh", background: T.bgGrad, color: T.ink, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <GlobalStyle T={T} />
      <header style={{ maxWidth: 780, margin: "0 auto", padding: "34px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="serif" style={{ fontSize: 42, lineHeight: 0.98, margin: 0, fontWeight: 600 }}>
              Quant<br /><em className="glowText" style={{ color: T.accent, fontWeight: 500 }}>Log</em>
            </h1>
            <div style={{ letterSpacing: "0.22em", fontSize: 10.5, color: T.dim, marginTop: 10, fontWeight: 500 }}>ONE CLASS AT A TIME</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeSwitcher themeKey={themeKey} onChange={chooseTheme} T={T} />
            <DaysRing days={daysToExam} T={T} />
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ color: T.accent, fontWeight: 600 }}>All sections</span>
            <span style={{ color: T.mut }}>{done} / {total} items</span>
          </div>
          <div style={{ height: 4, background: T.card2, borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${(done / total) * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, borderRadius: 99, boxShadow: `0 0 12px ${T.accent}88`, transition: "width .5s ease" }} />
          </div>
        </div>
        <div style={{ marginTop: 18, background: T.field, border: `1px solid ${T.line}`, borderRadius: 15, padding: 4, display: "flex", gap: 4 }}>
          {[["study", "Study"], ["revision", `Revision${queueN ? ` · ${queueN}` : ""}`], ["dash", "Dashboard"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "none", fontSize: 13, fontWeight: 600, background: view === k ? T.card2 : "transparent", color: view === k ? T.ink : T.mut, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              {view === k && <span style={{ width: 5, height: 5, borderRadius: 99, background: T.accent, boxShadow: `0 0 6px ${T.accent}`, flexShrink: 0 }} />}{l}
            </button>
          ))}
          {syncStatus === "saving" && <span style={{ alignSelf: "center", fontSize: 10, color: T.dim, paddingRight: 10 }}>syncing</span>}
          {syncStatus === "saved" && <span style={{ alignSelf: "center", fontSize: 10, color: T.good, paddingRight: 10 }}>saved</span>}
          {syncStatus === "error" && (
            <button onClick={flush} style={{ alignSelf: "center", fontSize: 10, fontWeight: 700, color: T.accent2, paddingRight: 10, background: "none", border: "none" }}>
              not saved — retry
            </button>
          )}
        </div>
      </header>
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "16px 20px 90px", display: "flex", flexDirection: "column", gap: 14 }}>
        {view === "study" && <Study state={state} persist={persist} struggles={struggles} setStruggles={setStruggles} now={now} T={T} />}
        {view === "revision" && <Revision struggles={struggles} setStruggles={setStruggles} state={state} persist={persist} now={now} T={T} />}
        {view === "dash" && <Dashboard state={state} persist={persist} struggles={struggles} now={now} T={T} />}
      </main>
    </div>
  );
}

function GlobalStyle({ T }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Outfit:wght@300;400;500;600;700&display=swap');
      .serif { font-family: 'Fraunces', Georgia, serif; }
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      button { transition: all .16s ease; cursor: pointer; font-family: inherit; }
      button:active { transform: scale(.98); }
      input, textarea { font-family: inherit; }
      details summary::-webkit-details-marker { display:none; }
      .card { background:${T.card}; border:1px solid ${T.line}; border-radius:20px; }
      .glowText { text-shadow: 0 0 22px ${T.accent}66; }
      @keyframes emberIn { 0%{transform:scale(.985)} 60%{transform:scale(1.006)} 100%{transform:scale(1)} }
      .completed-pop { animation: emberIn .4s ease; }
      @media (prefers-reduced-motion: reduce){ .completed-pop{animation:none} }
      ::-webkit-scrollbar{width:8px} ::-webkit-scrollbar-thumb{background:${T.line};border-radius:99px}
      body { background:${T.bgGrad}; }
      /* installed-PWA safe areas (notch / home indicator) */
      header { padding-top: calc(34px + env(safe-area-inset-top)) !important; }
      main { padding-bottom: calc(90px + env(safe-area-inset-bottom)) !important; }
      /* keyboard accessibility — visible focus without mouse-click outlines */
      :focus { outline: none; }
      :focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; border-radius: 6px; }
      /* let cards ease between themes instead of snapping */
      .card, body, button, input, textarea { transition: background .25s ease, border-color .25s ease, color .2s ease; }
    `}</style>
  );
}

function Splash({ T, text }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bgGrad, display: "grid", placeItems: "center", fontFamily: "Georgia, serif" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: T.ink, animation: "pulse 1.6s ease-in-out infinite" }}>
          Quant<em style={{ color: T.accent }}>Log</em>
        </div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 8, letterSpacing: "0.18em", fontFamily: "system-ui" }}>{text.toUpperCase()}</div>
      </div>
    </div>
  );
}

function Login({ code, setCodeInput, onSubmit, err, T }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bgGrad, display: "grid", placeItems: "center", padding: 20 }}>
      <GlobalStyle T={T} />
      <div className="card" style={{ padding: 28, width: 320, color: T.ink }}>
        <h1 className="serif" style={{ fontSize: 28, margin: "0 0 4px" }}>Quant<em style={{ color: T.accent }}>Log</em></h1>
        <p style={{ fontSize: 12.5, color: T.mut, margin: "0 0 16px" }}>Enter the access code you both agreed on.</p>
        <input autoFocus type="password" value={code} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Access code" style={{ width: "100%", background: T.field, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, color: T.ink, fontSize: 14, outline: "none" }} />
        {err && <div style={{ color: T.accent2, fontSize: 12, marginTop: 8, fontWeight: 600 }}>{err}</div>}
        <button onClick={onSubmit} style={{ width: "100%", marginTop: 14, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 12, padding: 12, color: T.onAccent, fontWeight: 700, fontSize: 13.5 }}>Enter</button>
      </div>
    </div>
  );
}

function ThemeSwitcher({ themeKey, onChange, T }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ width: 40, height: 40, borderRadius: 12, background: T.card2, border: `1px solid ${T.line}`, display: "grid", placeItems: "center" }}>
        {Icon.palette(T.accent)}
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 46, padding: 8, zIndex: 20, minWidth: 170 }}>
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 10, border: "none", background: k === themeKey ? T.card2 : "transparent", color: T.ink, fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, flexShrink: 0 }} />
              {t.name}{k === themeKey ? Icon.check(T.accent) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DaysRing({ days, T }) {
  const pct = clamp(1 - days / 110, 0, 1);
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 76, height: 76 }}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke={T.card2} strokeWidth="5" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={T.accent} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 38 38)" style={{ filter: `drop-shadow(0 0 6px ${T.accent})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><div className="serif" style={{ fontSize: 19, fontWeight: 700, color: T.accent }}>{days}</div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: T.dim, fontWeight: 600 }}>DAYS</div></div>
      </div>
    </div>
  );
}

/* ================================================================
   STUDY
   ================================================================ */
function Study({ state, persist, struggles, setStruggles, now, T }) {
  const today = dayKey(now);
  const isRevisionDay = state.settings.revisionDays.includes(now.getDay());
  const streak = streakDays(state);

  const logAct = (next, type) => ({ ...next, log: [...state.log, { date: today, type }] });
  const toggle = (id, key) => {
    const cur = state.items[id] || {};
    const val = !cur[key];
    const next = { ...state, items: { ...state.items, [id]: { ...cur, [key]: val } } };
    persist(val ? logAct(next, key) : next);
  };
  const toggleFlag = (id) => persist({ ...state, flags: { ...state.flags, [id]: !state.flags[id] } });

  return (
    <>
      <div className="card" style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"}</div>
          <div style={{ fontSize: 12.5, color: T.mut, marginTop: 3 }}>{isRevisionDay ? <span style={{ color: T.accent, fontWeight: 600 }}>Revision day — the queue is waiting in the Revision tab.</span> : "One class, then its questions. That is the whole method."}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="serif glowText" style={{ fontSize: 24, fontWeight: 700, color: streak > 0 ? T.accent : T.dim }}>{streak > 0 ? streak : "0"}</div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: T.dim, fontWeight: 600 }}>DAY STREAK</div>
        </div>
      </div>
      {SECTIONS.map((s) => <SectionCard key={s.id} s={s} state={state} onToggle={toggle} onFlag={toggleFlag} T={T} />)}
      <StruggleBox state={state} persist={persist} struggles={struggles} setStruggles={setStruggles} today={today} T={T} />
    </>
  );
}

function SectionCard({ s, state, onToggle, onFlag, T }) {
  const [open, setOpen] = useState(s.id === "arith");
  const st = sectionStats(state, s);
  return (
    <div className="card" style={{ overflow: "hidden", border: `1px solid ${st.allDone ? T.gold + "66" : T.line}`, background: st.allDone ? `linear-gradient(150deg, ${T.card2}, ${T.card})` : T.card, boxShadow: st.allDone ? `0 0 28px ${T.accent}22` : "none" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "none", border: "none", color: T.ink, textAlign: "left", padding: "17px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <MiniRing pct={st.pct} done={st.allDone} T={T} />
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 17.5, fontWeight: 600, color: st.allDone ? T.gold : T.ink }}>{s.name}</div>
          <div style={{ fontSize: 11.5, color: T.mut, marginTop: 2 }}>{st.clsDone}/{st.clsTotal} classes · {st.setsDone}/{st.setsTotal} practice sets</div>
        </div>
        {Icon.chevron(open, T.dim)}
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {s.items.map((it) => it.kind === "s"
            ? <SetRow key={it.id} it={it} state={state} onToggle={onToggle} onFlag={onFlag} T={T} />
            : <ClassRow key={it.id} it={it} state={state} onToggle={onToggle} onFlag={onFlag} T={T} />)}
        </div>
      )}
    </div>
  );
}

function MiniRing({ pct, done, T }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r={r} fill="none" stroke={T.card2} strokeWidth="3.5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={done ? T.gold : T.accent} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dashoffset .5s ease", filter: pct > 0 ? `drop-shadow(0 0 4px ${done ? T.gold : T.accent})` : "none" }} />
      <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="700" fill={done ? T.gold : T.mut} fontFamily="Outfit">{Math.round(pct * 100)}</text>
    </svg>
  );
}

function ClassRow({ it, state, onToggle, onFlag, T }) {
  const v = state.items[it.id] || {};
  const done = !!v.v;
  const isDrill = it.kind === "d";
  return (
    <div className={done ? "completed-pop" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 13, background: done ? T.card2 : "transparent", border: `1px solid ${done ? T.accent2 + "40" : "transparent"}` }}>
      <button onClick={() => onToggle(it.id, "v")} style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${done ? T.accent : T.line}`, background: done ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : "transparent", display: "grid", placeItems: "center", boxShadow: done ? `0 0 8px ${T.accent}44` : "none" }}>
        {Icon.check(done ? T.onAccent : "transparent")}
      </button>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: done ? 600 : 500, color: done ? T.gold : isDrill ? T.mut : T.ink, lineHeight: 1.3, fontStyle: isDrill ? "italic" : "normal", opacity: isDrill ? 0.85 : 1 }}>{it.name}</span>
      <button onClick={() => onFlag(it.id)} style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: "transparent", display: "grid", placeItems: "center" }}>
        {state.flags[it.id] ? Icon.bookmarkFill(T.gold) : Icon.bookmark(T.line)}
      </button>
    </div>
  );
}

function SetRow({ it, state, onToggle, onFlag, T }) {
  const v = state.items[it.id] || {};
  const done = !!(v.l1 && v.l2);
  const pill = (key, label) => (
    <button onClick={() => onToggle(it.id, key)} style={{ padding: "6px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${v[key] ? T.accent : T.line}`, background: v[key] ? (done ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.card2) : "transparent", color: v[key] ? (done ? T.onAccent : T.accent) : T.dim, boxShadow: v[key] ? `0 0 8px ${T.accent}33` : "none" }}>{label}</button>
  );
  return (
    <div className={done ? "completed-pop" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 10px", borderRadius: 13, margin: "2px 0", background: done ? `linear-gradient(90deg, ${T.card2}, ${T.card})` : T.card2, border: `1px solid ${done ? T.gold + "55" : T.line}`, boxShadow: done ? `0 0 16px ${T.accent}22` : "none" }}>
      <span style={{ color: done ? T.gold : T.dim, flexShrink: 0 }}>{Icon.book(done ? T.gold : T.dim)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", color: done ? T.gold : T.dim, fontWeight: 700 }}>PRACTICE SET</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: done ? T.gold : T.ink, lineHeight: 1.3 }}>{it.name}</div>
      </div>
      {pill("l1", "LOD 1")}{pill("l2", "LOD 2")}
      <button onClick={() => onFlag(it.id)} style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: "transparent", display: "grid", placeItems: "center" }}>
        {state.flags[it.id] ? Icon.bookmarkFill(T.gold) : Icon.bookmark(T.line)}
      </button>
    </div>
  );
}

/* ---------------- Struggle box ---------------- */
function StruggleBox({ state, persist, struggles, setStruggles, today, T }) {
  const [text, setText] = useState("");
  const [ansText, setAnsText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [ansPhoto, setAnsPhoto] = useState(null);
  const [showAns, setShowAns] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(); const ansRef = useRef();

  const pick = async (e, setter) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setter(await compressImage(f)); } catch { setMsg("Couldn't read that image"); }
    e.target.value = "";
  };

  const submit = async () => {
    if (!text.trim() && !photo) return;
    setBusy(true); setMsg("");
    let topicId = "other";
    try { const r = await api.classify({ text: text.trim(), imageDataUrl: photo }); topicId = r.itemId || "other"; } catch (e) { console.error(e); }
    const id = uid();
    try {
      if (photo) await api.uploadPhoto(id, photo);
      if (ansPhoto) await api.uploadPhoto(`${id}-ans`, ansPhoto);
      const entry = { id, text: text.trim(), topicId, date: today, hasPhoto: !!photo, hasAnsPhoto: !!ansPhoto, answerText: ansText.trim() };
      await api.createStruggle(entry);
      setStruggles([...struggles, { ...entry, retired: false, lastTried: null, keepCount: 0 }]);
      await persist({ ...state, log: [...state.log, { date: today, type: "struggle" }] });
      setMsg(topicId !== "other" ? `Filed under ${ITEM_BY_ID[topicId]?.name}` : "Saved");
    } catch (e) { console.error(e); setMsg("Couldn't save — try again"); }
    setText(""); setAnsText(""); setPhoto(null); setAnsPhoto(null); setShowAns(false); setBusy(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const inputStyle = { width: "100%", background: T.field, border: `1px solid ${T.line}`, borderRadius: 13, padding: 13, fontSize: 13.5, color: T.ink, outline: "none", resize: "none" };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="serif" style={{ fontSize: 17, fontWeight: 600 }}>Stuck on a question?</div>
      <div style={{ fontSize: 12, color: T.mut, margin: "3px 0 12px" }}>Type it or photograph it. It files itself and joins the revision queue.</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="e.g. Q14, page 87 — why LCM here?" style={inputStyle} />
      {photo && (
        <div style={{ position: "relative", display: "inline-block", marginTop: 10 }}>
          <img src={photo} alt="question" style={{ height: 96, borderRadius: 12, border: `1px solid ${T.line}` }} />
          <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: T.card2, border: `1px solid ${T.line}`, color: T.mut, fontSize: 11 }}>×</button>
        </div>
      )}
      {showAns && (
        <div style={{ marginTop: 10, padding: 12, background: T.field, borderRadius: 13, border: `1px dashed ${T.line}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.1em", marginBottom: 7 }}>ANSWER — OPTIONAL</div>
          <input value={ansText} onChange={(e) => setAnsText(e.target.value)} placeholder="e.g. Option B / 42" style={{ ...inputStyle, background: T.card2, padding: 10 }} />
          {ansPhoto && (
            <div style={{ position: "relative", display: "inline-block", marginTop: 8 }}>
              <img src={ansPhoto} alt="answer" style={{ height: 64, borderRadius: 10, border: `1px solid ${T.line}` }} />
              <button onClick={() => setAnsPhoto(null)} style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", background: T.card2, border: `1px solid ${T.line}`, color: T.mut, fontSize: 10 }}>×</button>
            </div>
          )}
          <button onClick={() => ansRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, background: "none", border: "none", fontSize: 11.5, fontWeight: 700, color: T.accent, padding: 0 }}>{Icon.camera(T.accent)} photo of the solution</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => fileRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 7, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: T.mut }}>{Icon.camera(T.mut)} Photo</button>
          {!showAns && <button onClick={() => setShowAns(true)} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: T.dim }}>+ answer</button>}
          <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>{msg}</span>
        </div>
        <button onClick={submit} disabled={busy || (!text.trim() && !photo)} style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 12.5, fontWeight: 700, color: T.onAccent, opacity: busy || (!text.trim() && !photo) ? 0.4 : 1, boxShadow: `0 0 18px ${T.accent}44` }}>{busy ? "Filing" : "File it"}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e, setPhoto)} />
      <input ref={ansRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pick(e, setAnsPhoto)} />
    </div>
  );
}

/* ================================================================
   REVISION
   ================================================================ */
function Revision({ struggles, setStruggles, state, persist, now, T }) {
  const [filter, setFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const today = dayKey(now);

  const queue = struggles.filter((s) => !s.retired);
  const filtered = filter === "all" ? queue : queue.filter((s) => ITEM_BY_ID[s.topicId]?.sectionId === filter);
  const flagged = Object.keys(state.flags).filter((id) => state.flags[id] && ITEM_BY_ID[id]);
  const archive = struggles.filter((s) => s.retired);

  const update = async (id, patch) => {
    setStruggles(struggles.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try { await api.patchStruggle(id, patch); } catch (e) { console.error(e); }
    await persist({ ...state, log: [...state.log, { date: today, type: "revision" }] });
  };
  const retire = (id) => update(id, { retired: true, lastTried: today });
  const keep = (id) => { const s = struggles.find((x) => x.id === id); update(id, { lastTried: today, keepCount: (s?.keepCount || 0) + 1 }); };
  const unflag = (id) => persist({ ...state, flags: { ...state.flags, [id]: false }, log: [...state.log, { date: today, type: "revision" }] });

  const doExport = async () => { setExporting(true); try { await exportRevisionDoc(filtered, flagged); } catch (e) { console.error(e); } setExporting(false); };

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Revision queue</div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>{queue.length} question{queue.length === 1 ? "" : "s"} waiting · {flagged.length} bookmarked</div>
          </div>
          <button onClick={doExport} disabled={exporting || (filtered.length === 0 && flagged.length === 0)} style={{ display: "flex", alignItems: "center", gap: 7, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 11, padding: "9px 15px", fontSize: 11.5, fontWeight: 700, color: T.onAccent, opacity: exporting || (filtered.length === 0 && flagged.length === 0) ? 0.4 : 1, boxShadow: `0 0 16px ${T.accent}44`, flexShrink: 0 }}>{Icon.download(T.onAccent)} {exporting ? "Preparing" : "Export .doc"}</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {[["all", "All"], ...SECTIONS.map((s) => [s.id, s.name])].map(([k, l]) => {
            const on = filter === k;
            const n = k === "all" ? queue.length : queue.filter((s) => ITEM_BY_ID[s.topicId]?.sectionId === k).length;
            return <button key={k} onClick={() => setFilter(k)} style={{ padding: "7px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.card2 : "transparent", color: on ? T.accent : n ? T.mut : T.line }}>{l}{n ? ` · ${n}` : ""}</button>;
          })}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut }}>{filter === "all" ? "The queue is empty. File a question from the Study tab when something feels shaky." : "Nothing filed under this section."}</div>
      ) : filtered.map((s) => <QueueCard key={s.id} s={s} now={now} onRetire={() => retire(s.id)} onKeep={() => keep(s.id)} T={T} />)}
      {flagged.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div className="serif" style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Bookmarked for revision</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {flagged.map((id) => (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>{Icon.bookmarkFill(T.gold, 12)} {ITEM_BY_ID[id].name} <span style={{ color: T.dim, fontSize: 11 }}>· {ITEM_BY_ID[id].sectionName}</span></div>
                <button onClick={() => unflag(id)} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 99, padding: "6px 13px", fontSize: 11, fontWeight: 700, color: T.mut, flexShrink: 0 }}>Revisited</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {archive.length > 0 && (
        <details className="card" style={{ padding: 20 }}>
          <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div className="serif" style={{ fontSize: 16, fontWeight: 600 }}>Cleared</div><div style={{ fontSize: 11.5, color: T.mut, marginTop: 2 }}>{archive.length} question{archive.length === 1 ? "" : "s"} worked through and retired</div></div>
            <span style={{ color: T.dim }}>{Icon.chevron(false, T.dim)}</span>
          </summary>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {[...archive].reverse().map((s) => (
              <div key={s.id} style={{ fontSize: 12.5, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}`, color: T.mut }}>
                <span style={{ fontWeight: 700, color: T.dim }}>{ITEM_BY_ID[s.topicId]?.name || "Other"}</span>
                <span style={{ color: T.dim }}> · filed {s.date} · cleared {s.lastTried}{s.keepCount ? ` · took ${s.keepCount + 1} tries` : ""}</span>
                {s.text && <div style={{ marginTop: 3, lineHeight: 1.4 }}>{s.text}</div>}
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function QueueCard({ s, now, onRetire, onKeep, T }) {
  const [img, setImg] = useState(null);
  const [ansImg, setAnsImg] = useState(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { if (s.hasPhoto) fetchPhotoUrl(s.id).then(setImg); return () => img && URL.revokeObjectURL(img); }, [s.id, s.hasPhoto]);
  useEffect(() => { if (reveal && s.hasAnsPhoto && !ansImg) fetchPhotoUrl(`${s.id}-ans`).then(setAnsImg); }, [reveal]);
  const hasAnswer = s.answerText || s.hasAnsPhoto;
  const age = daysBetween(s.lastTried || s.date, now);
  const stale = age >= 14;

  return (
    <div className="card" style={{ padding: 16, border: `1px solid ${stale ? T.accent2 + "80" : T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: "0.08em" }}>{(ITEM_BY_ID[s.topicId]?.name || "OTHER").toUpperCase()} · filed {s.date}{s.keepCount > 0 ? ` · kept ${s.keepCount}×` : ""}</div>
        {stale && <span style={{ fontSize: 9.5, fontWeight: 700, color: T.gold, letterSpacing: "0.08em", background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "3px 9px", flexShrink: 0 }}>UNTOUCHED {age}D</span>}
      </div>
      {s.text && <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.ink }}>{s.text}</div>}
      {img && <img src={img} alt="question" style={{ marginTop: 8, borderRadius: 10, maxHeight: 220, maxWidth: "100%", border: `1px solid ${T.line}` }} />}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={onRetire} style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, color: T.onAccent }}>Got it — clear</button>
        <button onClick={onKeep} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, color: T.accent }}>Still shaky — keep</button>
        {hasAnswer && !reveal && <button onClick={() => setReveal(true)} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 600, color: T.mut }}>Reveal answer</button>}
      </div>
      {reveal && (
        <div style={{ marginTop: 9, padding: 11, background: T.field, borderRadius: 10, border: `1px solid ${T.line}` }}>
          {s.answerText && <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gold }}>{s.answerText}</div>}
          {ansImg && <img src={ansImg} alt="answer" style={{ marginTop: 5, borderRadius: 9, maxHeight: 160, maxWidth: "100%" }} />}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function Dashboard({ state, persist, struggles, now, T }) {
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestErr, setDigestErr] = useState("");
  const total = ALL_ITEMS.length;
  const done = ALL_ITEMS.filter((i) => itemDone(state, i)).length;

  const elapsed = Math.max(0, (now - START_DATE) / 864e5);
  const span = (TARGET - START_DATE) / 864e5;
  const expected = Math.round(clamp(elapsed / span, 0, 1) * total);
  const delta = done - expected;
  const tone = delta >= 0 ? { c: T.good, word: delta === 0 ? "exactly on pace" : `${delta} ahead of pace` }
    : delta >= -7 ? { c: T.gold, word: `${-delta} behind — one good week fixes it` }
      : { c: T.accent2, word: `${-delta} behind — adjust the week` };

  const binCounts = {};
  struggles.forEach((s) => { binCounts[s.topicId] = (binCounts[s.topicId] || 0) + 1; });
  const bins = Object.entries(binCounts).sort((a, b) => b[1] - a[1]);

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    return { day: DAY_NAMES[d.getDay()][0], n: state.log.filter((l) => l.date === dayKey(d)).length };
  });

  const cleared = struggles.filter((s) => s.retired).length;
  const queueN = struggles.length - cleared;

  const runDigest = async () => {
    setDigestBusy(true);
    try {
      const perSection = SECTIONS.map((s) => { const st = sectionStats(state, s); return `${s.name} ${st.clsDone}/${st.clsTotal} classes ${st.setsDone}/${st.setsTotal} sets`; }).join("; ");
      const wk = []; for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); wk.push(dayKey(d)); }
      const acts = state.log.filter((l) => wk.includes(l.date));
      const weekStruggles = struggles.filter((s) => wk.includes(s.date));
      const wbins = {}; weekStruggles.forEach((s) => { wbins[s.topicId] = (wbins[s.topicId] || 0) + 1; });
      const binStr = Object.entries(wbins).map(([id, n]) => `${ITEM_BY_ID[id]?.name || "Other"}: ${n}`).join(", ");
      const summary = `Activity events this week: ${acts.length}. Progress: ${perSection}. New struggle notes this week: ${binStr || "none"}. Revision queue size: ${queueN}. Exam Nov 29. Today ${dayKey(now)}.`;
      const r = await api.digest(summary);
      await persist({ ...state, digest: r.digest, digestDate: dayKey(now) });
      setDigestErr("");
    } catch (e) { console.error(e); setDigestErr("Couldn't reach the AI — try again in a moment."); }
    setDigestBusy(false);
  };

  const setRevDays = (d) => {
    const cur = state.settings.revisionDays;
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].slice(-2);
    if (!next.length) return;
    persist({ ...state, settings: { ...state.settings, revisionDays: next } });
  };

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Pace</div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: tone.c, textShadow: `0 0 12px ${tone.c}55` }}>{tone.word}</span>
        </div>
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 16 }}>Soft target: everything by Nov 8, leaving three weeks for revision and mocks. Judged weekly, never daily.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12.5, color: T.mut, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}` }}>Expected: ~{expected} · Actual: <span style={{ color: T.ink, fontWeight: 700 }}>{done}</span> of {total}</div>
          <div style={{ flex: 1, fontSize: 12.5, color: T.mut, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}` }}>Revision: <span style={{ color: T.ink, fontWeight: 700 }}>{cleared}</span> cleared · {queueN} in queue</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Sections</div>
        {SECTIONS.map((s) => {
          const st = sectionStats(state, s);
          return (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: st.allDone ? T.gold : T.ink }}>{s.name}</span>
                <span style={{ color: T.dim }}>{st.clsDone}/{st.clsTotal} classes · {st.setsDone}/{st.setsTotal} sets</span>
              </div>
              <div style={{ height: 7, background: T.field, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${st.pct * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, borderRadius: 99, boxShadow: st.pct ? `0 0 8px ${T.accent}55` : "none", transition: "width .5s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Last 7 days</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 76 }}>
          {last7.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: "100%", borderRadius: "6px 6px 3px 3px", height: clamp(d.n * 15, d.n ? 10 : 3, 64), background: d.n ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.card2, boxShadow: d.n ? `0 0 10px ${T.accent}44` : "none" }} />
              <span style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Struggle bins</div>
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 14 }}>Auto-filed from the drop-box. Brighter and larger means more filed questions.</div>
        {bins.length === 0 ? <div style={{ fontSize: 13, color: T.dim }}>Nothing filed yet.</div> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {bins.map(([id, n], idx) => (
              <span key={id} style={{ padding: "7px 14px", borderRadius: 99, fontWeight: 700, fontSize: clamp(11 + n * 1.2, 11, 17), background: T.card2, color: idx === 0 ? T.accent : T.gold, border: `1px solid ${idx === 0 ? T.accent2 + "80" : T.line}`, boxShadow: idx === 0 ? `0 0 14px ${T.accent}33` : "none" }}>{ITEM_BY_ID[id]?.name || "Other"} · {n}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Weekly digest</div>
          <button onClick={runDigest} disabled={digestBusy} style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 11, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, color: T.onAccent, opacity: digestBusy ? 0.5 : 1 }}>{digestBusy ? "Reading" : state.digest ? "Refresh" : "Generate"}</button>
        </div>
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 12 }}>Three honest sentences about the week. Only visible here.</div>
        {digestErr && <div style={{ fontSize: 12, fontWeight: 600, color: T.accent2, marginBottom: 8 }}>{digestErr}</div>}
        {state.digest ? <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.ink, background: T.card2, borderRadius: 13, padding: 15, border: `1px solid ${T.line}` }}>{state.digest}<div style={{ fontSize: 10, color: T.dim, marginTop: 8 }}>{state.digestDate}</div></div> : <div style={{ fontSize: 13, color: T.dim }}>No digest yet.</div>}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Revision days</div>
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 12 }}>Pick one or two days. The Study view nudges toward the Revision tab on these days.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_NAMES.map((d, i) => {
            const on = state.settings.revisionDays.includes(i);
            return <button key={d} onClick={() => setRevDays(i)} style={{ padding: "9px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.card2 : T.card2, color: on ? T.accent : T.mut, boxShadow: on ? `0 0 12px ${T.accent}33` : "none" }}>{d}</button>;
          })}
        </div>
        <div style={{ fontSize: 10, color: T.dim, marginTop: 16 }}>Data lives in your own Supabase project, behind your access code. Photos are private and only ever fetched through the server.</div>
      </div>
    </>
  );
}
