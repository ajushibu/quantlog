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


/* Every change carries a timestamp so the server can merge two devices'
   edits instead of one silently overwriting the other. */
const stampItem = (state, key, id) => ({
  ...state,
  meta: { ...(state.meta || {}), [key]: { ...((state.meta || {})[key] || {}), [id]: Date.now() } },
});
const stampField = (state, field) => ({
  ...state,
  meta: { ...(state.meta || {}), [field]: Date.now() },
});


/* A "cluster" mirrors one book chapter: the classes leading up to a
   practice set, plus that set. Percentages = its 4 classes + the
   Percentages LOD1/LOD2 set, exactly as she described it. */
function buildClusters(section) {
  const clusters = [];
  // sections without practice sets (e.g. VARC) declare thematic groups instead
  if (section.groups) {
    let idx = 0;
    section.groups.forEach((g, gi) => {
      const slice = section.items.slice(idx, idx + g.count);
      idx += g.count;
      if (slice.length) clusters.push({ id: `${section.id}-cl${gi}`, name: g.name, classIds: slice.map((c) => c.id), setId: null });
    });
    return clusters;
  }
  let run = [];
  section.items.forEach((it) => {
    if (it.kind === "s") { clusters.push({ id: `${section.id}-cl${clusters.length}`, name: it.name, classIds: run.map((c) => c.id), setId: it.id }); run = []; }
    else run.push(it);
  });
  return clusters;
}
const CLUSTERS_BY_SECTION = Object.fromEntries(SECTIONS.map((s) => [s.id, buildClusters(s)]));
const ALL_CLUSTERS = SECTIONS.flatMap((s) => CLUSTERS_BY_SECTION[s.id]);

function clusterAllIds(cl) { return cl.setId ? [...cl.classIds, cl.setId] : [...cl.classIds]; }
function clusterDone(state, cl) {
  const classesDone = cl.classIds.every((id) => !!(state.items[id] || {}).v);
  return classesDone && (!cl.setId || itemDone(state, ITEM_BY_ID[cl.setId]));
}
function clustersContaining(itemId) {
  return ALL_CLUSTERS.filter((cl) => clusterAllIds(cl).includes(itemId));
}


/* Study is split by exam area so a single scroll isn't 142 rows long. */
const AREAS = [
  { id: "quant", label: "Quant", sectionIds: ["arith", "algebra", "geo", "num", "mod"] },
  { id: "varc", label: "VARC", sectionIds: ["varc"] },
];
const areaSections = (areaId) => SECTIONS.filter((s) => (AREAS.find((a) => a.id === areaId)?.sectionIds || []).includes(s.id));


/* Questions come from the book's chapters, not from individual classes —
   there is no LOD set for "Successive %", only for Percentages as a whole.
   So filing offers the 19 practice-set chapters plus VARC's 5 groups:
   24 options instead of 142. */
const TOPIC_OPTIONS = SECTIONS.flatMap((sec) => {
  const sets = sec.items.filter((i) => i.kind === "s");
  if (sets.length) return sets.map((it) => ({ id: it.id, name: it.name, sectionId: sec.id, sectionName: sec.name }));
  return (CLUSTERS_BY_SECTION[sec.id] || []).map((cl) => ({ id: cl.id, name: cl.name, sectionId: sec.id, sectionName: sec.name }));
});
const TOPIC_OPTION_BY_ID = Object.fromEntries(TOPIC_OPTIONS.map((t) => [t.id, t]));

/* Filed questions may carry either a chapter id, a cluster id, or (from
   before this change) a plain class id — resolve all three. */
const topicName = (id) => TOPIC_OPTION_BY_ID[id]?.name || ITEM_BY_ID[id]?.name || "Other";
const topicSectionId = (id) => TOPIC_OPTION_BY_ID[id]?.sectionId || ITEM_BY_ID[id]?.sectionId || null;


const weekStart = (ds) => { const d = new Date(ds + "T00:00:00"); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return dayKey(d); };
const weekLabel = (ws, currentWs) => {
  if (ws === currentWs) return "This week";
  const d = new Date(ws + "T00:00:00"); const e = new Date(d); e.setDate(e.getDate() + 6);
  const f = (x) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${f(d)} – ${f(e)}`;
};


/* Spaced repetition.
   A question is shown when it is DUE, not because of the week it was filed in.
   First gap depends on how hard she marked it; a "still shaky" resets it to a
   short gap (that is the point of marking it shaky) which stretches only
   slightly if she keeps missing it, so it neither nags daily nor drifts away. */
const FIRST_GAP = { 3: 2, 2: 4, 1: 7, 0: 4 };   // priority -> days
const LAPSE_GAPS = [2, 3, 5];                    // successive "still shaky" gaps
const addDays = (ds, n) => { const d = new Date(ds + "T00:00:00"); d.setDate(d.getDate() + n); return dayKey(d); };
const schedOf = (state, s) => (state.sched || {})[s.id] || null;

/* The raw gap says "ready to be tested again". Her revision days say "when
   revision actually happens". A question ready on Wednesday when she only
   revises Sundays isn't overdue — it just waits for Sunday. So the shown due
   date is the first revision day on or after the raw date. Because this is
   computed rather than stored, changing revision days re-schedules
   everything instantly with no migration. */
function snapToRevisionDay(ds, revisionDays) {
  if (!revisionDays || !revisionDays.length || revisionDays.length >= 7) return ds;
  const d = new Date(ds + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    if (revisionDays.includes(d.getDay())) return dayKey(d);
    d.setDate(d.getDate() + 1);
  }
  return ds;
}
const rawDue = (state, s) => schedOf(state, s)?.due || s.date;
/* legacy items (filed before scheduling existed) are simply due now */
const dueDate = (state, s) => snapToRevisionDay(rawDue(state, s), state.settings?.revisionDays);
const isDue = (state, s, today) => dueDate(state, s) <= today;
const prioOfItem = (state, s) => schedOf(state, s)?.p || (s.id.startsWith("qb-") ? (state.qbStars?.[s.id.slice(3)] || 0) : 0);
const daysUntil = (ds, today) => Math.round((new Date(ds + "T00:00:00") - new Date(today + "T00:00:00")) / 864e5);

function defaultState() {
  return { settings: { revisionDays: [0] }, items: {}, flags: {}, celebrated: {}, qbStars: {}, sched: {}, mocks: [], log: [], digest: "", digestDate: "", meta: {} };
}

const itemDone = (st, it) => { const v = st.items[it.id] || {}; return it.kind === "s" ? !!(v.qb || (v.l1 && v.l2)) : !!v.v; };
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

/* Real PDF, not HTML-renamed-to-.doc (which iOS shows as raw markup).
   Text and photos are laid out in order, paginated, so a question that has
   both reads as one block. */
/* jsPDF's built-in fonts only speak Latin-1. Anything outside it (₹, ★, curly
   quotes, em-dashes) renders as broken glyphs with stray spacing — so every
   string is passed through this before printing. */
function pdfSafe(t) {
  return String(t || "")
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[★]/g, "*")
    .replace(/[☆]/g, "")
    .replace(/…/g, "...")
    .replace(/[×✕]/g, "x")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\xFF\n]/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

async function exportRevisionDoc(queue, flagged) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 48;                       // margin
  const CW = PW - M * 2;              // content width
  let y = M;

  const need = (h) => { if (y + h > PH - M) { doc.addPage(); y = M; } };

  // --- header ---
  doc.setFont("times", "bold"); doc.setFontSize(20); doc.setTextColor(20, 20, 20);
  doc.text("Revision Sheet", M, y + 6); y += 26;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`${new Date().toDateString()}  ·  ${queue.length} question${queue.length === 1 ? "" : "s"} due`, M, y); y += 14;
  doc.setDrawColor(210, 210, 210); doc.line(M, y, PW - M, y); y += 22;

  if (flagged.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(70, 70, 70);
    doc.text("Also revisit notes for:", M, y); y += 13;
    doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 110);
    const names = pdfSafe(flagged.map((id) => topicName(id)).filter(Boolean).join(", "));
    const lines = doc.splitTextToSize(names, CW);
    doc.text(lines, M, y); y += lines.length * 12 + 16;
    doc.setDrawColor(230, 230, 230); doc.line(M, y - 8, PW - M, y - 8);
  }

  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    need(90);

    // question label
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(150, 90, 20);
    const label = pdfSafe(`Q${i + 1}  -  ${topicName(q.topicId)}  -  filed ${q.date}${q.keepCount ? `  -  missed ${q.keepCount}x` : ""}`);
    doc.text(label, M, y); y += 13;

    // where to find it (and its answer) in the book
    const srcRef = q.answerText && q.answerText.startsWith("Check answer in: ") ? q.answerText.slice("Check answer in: ".length) : "";
    if (srcRef) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
      doc.text(pdfSafe(`Source: ${srcRef}`), M, y); y += 13;
    } else { y += 2; }

    // question text
    if (q.text) {
      doc.setFont("times", "normal"); doc.setFontSize(12); doc.setTextColor(25, 25, 25);
      const lines = doc.splitTextToSize(pdfSafe(q.text), CW);
      for (const ln of lines) { need(16); doc.text(ln, M, y); y += 15; }
      y += 4;
    }

    // photo, scaled to fit and paginated
    if (q.hasPhoto) {
      try {
        const url = await fetchPhotoUrl(q.id);
        if (url) {
          const blob = await (await fetch(url)).blob();
          const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
          const dims = await new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.width, h: im.height }); im.onerror = () => res(null); im.src = dataUrl; });
          if (dims) {
            const maxW = CW, maxH = PH - M * 2 - 40;
            let w = Math.min(maxW, dims.w * 0.75);
            let h = (dims.h / dims.w) * w;
            if (h > maxH) { h = maxH; w = (dims.w / dims.h) * h; }
            need(h + 10);
            doc.addImage(dataUrl, "JPEG", M, y, w, h);
            y += h + 10;
          }
          URL.revokeObjectURL(url);
        }
      } catch (e) { console.error("photo export failed", e); }
    }

    // working space
    need(120);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(170, 170, 170);
    doc.text("Working", M, y + 10);
    doc.setDrawColor(224, 224, 224);
    doc.roundedRect(M, y + 16, CW, 104, 4, 4);
    y += 138;

    if (i < queue.length - 1) { doc.setDrawColor(238, 238, 238); need(10); doc.line(M, y - 12, PW - M, y - 12); }
  }

  if (!queue.length && !flagged.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(140, 140, 140);
    doc.text("Nothing in the revision queue.", M, y);
  }

  doc.save(`revision-${dayKey(new Date())}.pdf`);
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
  const syncStatusRef = useRef("");
  const lastSeenRef = useRef(null);
  useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);
  const saveTimer = useRef(null);
  const latestState = useRef(null);
  const flush = async () => {
    if (!latestState.current) return;
    const snapshot = latestState.current;
    setSyncStatus("saving");
    try {
      const res = await api.putState(snapshot);
      if (latestState.current === snapshot) {
        if (res?.data) { setState(res.data); latestState.current = null; }
        if (res?.updated_at) lastSeenRef.current = res.updated_at;
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus((s) => (s === "saved" ? "" : s)), 1500);
      }
    } catch (e) { console.error(e); setSyncStatus("error"); }
  };
  const persist = (next) => {
    setState(next);
    latestState.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; flush(); }, 600);
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

  /* Live sync. Two devices stay current via (a) a poll while the tab is
     visible, (b) an immediate refetch when the app regains focus. Pulls are
     skipped while a local save is in flight so we never overwrite unsent
     edits; the server merges by timestamp, so neither device clobbers the
     other. */
  const pullingRef = useRef(false);
  const pull = async () => {
    if (!getCode() || pullingRef.current) return;
    if (saveTimer.current || syncStatusRef.current === "saving") return; // local edits pending
    pullingRef.current = true;
    try {
      const [s, g] = await Promise.all([api.getState(), api.listStruggles()]);
      if (saveTimer.current || syncStatusRef.current === "saving") return; // raced with an edit
      if (s?.updated_at && s.updated_at === lastSeenRef.current) return;   // nothing new
      lastSeenRef.current = s?.updated_at || lastSeenRef.current;
      setState({ ...defaultState(), ...(s?.data || {}) });
      setStruggles(g.struggles.map((r) => ({
        id: r.id, text: r.text_body, topicId: r.topic_id, date: r.filed_on,
        answerText: r.answer_text, hasPhoto: r.has_photo, hasAnsPhoto: r.has_ans_photo,
        retired: r.retired, lastTried: r.last_tried, keepCount: r.keep_count,
      })));
    } catch { /* offline: keep showing local data */ }
    finally { pullingRef.current = false; }
  };

  useEffect(() => {
    if (!authed) return;
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", pull);
    const iv = setInterval(() => { if (document.visibilityState === "visible") pull(); }, 12000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", pull);
      clearInterval(iv);
    };
  }, [authed]);

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
      lastSeenRef.current = s?.updated_at || null;
      setState({ ...defaultState(), ...(s?.data || {}) });
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
              CAT<br /><em className="glowText" style={{ color: T.accent, fontWeight: 500 }}>Log</em>
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
          {[["study", "Study"], ["revision", `Revision${queueN ? ` · ${queueN}` : ""}`], ["mocks", "Mocks"], ["dash", "Dashboard"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "none", fontSize: 12.5, fontWeight: 600, background: view === k ? T.card2 : "transparent", color: view === k ? T.ink : T.mut, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
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
        {view === "mocks" && <Mocks state={state} persist={persist} now={now} T={T} />}
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
      .glowText { text-shadow: ${T.light ? "none" : `0 0 22px ${T.accent}66`}; }
      @keyframes emberIn { 0%{transform:scale(.985)} 60%{transform:scale(1.006)} 100%{transform:scale(1)} }
      .completed-pop { animation: emberIn .4s ease; }
      @media (prefers-reduced-motion: reduce){ .completed-pop{animation:none} }
      ::-webkit-scrollbar{width:8px} ::-webkit-scrollbar-thumb{background:${T.line};border-radius:99px}
      html, body { background:${T.bgGrad}; max-width: 100%; overflow-x: hidden; }
      /* long unbroken strings (question text, sources) must wrap, never widen the page */
      * { min-width: 0; overflow-wrap: anywhere; }
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
          CAT<em style={{ color: T.accent }}>Log</em>
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
        <h1 className="serif" style={{ fontSize: 28, margin: "0 0 4px" }}>CAT<em style={{ color: T.accent }}>Log</em></h1>
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
  const [bankTopics, setBankTopics] = useState([]);       // topic ids that have banks
  const [openBank, setOpenBank] = useState(null);         // { topicId, name, questions } | null
  const [bankLoading, setBankLoading] = useState(false);
  const bankCache = useRef({});
  useEffect(() => { api.listBanks().then((r) => setBankTopics(r.topics || [])).catch(() => {}); }, []);

  const showBank = async (setItem) => {
    if (bankCache.current[setItem.id]) { setOpenBank({ topicId: setItem.id, name: setItem.name, questions: bankCache.current[setItem.id] }); return; }
    setBankLoading(true);
    try {
      const r = await api.getBank(setItem.id);
      const qs = r.bank?.questions || [];
      bankCache.current[setItem.id] = qs;
      setOpenBank({ topicId: setItem.id, name: setItem.name, questions: qs });
    } catch (e) { console.error(e); }
    setBankLoading(false);
  };

  const starQuestion = async (q, priority) => {
    const sid = `qb-${q.id}`;
    const already = state.qbStars?.[q.id];
    const sid2 = `qb-${q.id}`;
    let next = stampItem({ ...state, qbStars: { ...state.qbStars, [q.id]: priority } }, "qbStars", q.id);
    next = stampItem({ ...next, sched: { ...next.sched, [sid2]: { p: priority, lapses: 0, due: addDays(today, FIRST_GAP[priority] || 4) } } }, "sched", sid2);
    persist(next);
    if (!already) {
      const optLines = Object.entries(q.options || {}).map(([k, v]) => `(${k}) ${v}`).join("   ");
      try {
        await api.createStruggle({
          id: sid, text: q.stem + (optLines ? `\n${optLines}` : ""), topicId: openBank.topicId,
          date: today, hasPhoto: false, hasAnsPhoto: false,
          answerText: q.source ? `Check answer in: ${q.source}` : "",
        });
        setStruggles((cur) => [...cur, { id: sid, text: q.stem + (optLines ? `\n${optLines}` : ""), topicId: openBank.topicId, date: today, hasPhoto: false, hasAnsPhoto: false, answerText: q.source ? `Check answer in: ${q.source}` : "", retired: false, lastTried: null, keepCount: 0 }]);
      } catch (e) { console.error(e); }
    }
  };
  const unstarQuestion = async (q) => {
    const sid = `qb-${q.id}`;
    // clear the star AND its schedule locally first, so the UI updates even
    // if the network call fails
    const nextStars = { ...state.qbStars, [q.id]: 0 };        // tombstone, not delete
    const nextSched = { ...(state.sched || {}), [sid]: null };
    let next = stampItem({ ...state, qbStars: nextStars, sched: nextSched }, "qbStars", q.id);
    next = stampItem(next, "sched", sid);
    persist(next);
    setStruggles((cur) => cur.map((x) => (x.id === sid ? { ...x, retired: true } : x)));
    try { await api.patchStruggle(sid, { retired: true, lastTried: today }); } catch (e) { console.error(e); }
  };
  const isRevisionDay = state.settings.revisionDays.includes(now.getDay());
  const streak = streakDays(state);
  const [celebration, setCelebration] = useState(null);
  const [area, setArea] = useState("quant");

  const logAct = (next, type) => ({ ...next, log: [...state.log, { date: today, type, seq: Date.now() }] });
  const toggle = (id, key) => {
    const cur = state.items[id] || {};
    const val = !cur[key];
    let next = { ...state, items: { ...state.items, [id]: { ...cur, [key]: val } } };
    next = stampItem(next, "items", id);
    if (val) next = logAct(next, key);

    if (val) {
      for (const cl of clustersContaining(id)) {
        if (clusterDone(next, cl) && !next.celebrated?.[cl.id]) {
          next = stampItem({ ...next, celebrated: { ...next.celebrated, [cl.id]: true } }, "celebrated", cl.id);
          setCelebration({ name: cl.name });
          break;
        }
      }
    }
    persist(next);
  };
  const toggleFlag = (id) => persist(stampItem({ ...state, flags: { ...state.flags, [id]: !state.flags[id] } }, "flags", id));

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
      {celebration && <ClusterCelebration data={celebration} onDone={() => setCelebration(null)} T={T} />}
      <div style={{ display: "flex", gap: 6, background: T.field, border: `1px solid ${T.line}`, borderRadius: 14, padding: 4 }}>
        {AREAS.map((a) => {
          const secs = areaSections(a.id);
          const items = secs.flatMap((sec) => sec.items);
          const doneN = items.filter((it) => itemDone(state, it)).length;
          const on = area === a.id;
          return (
            <button key={a.id} onClick={() => setArea(a.id)} style={{
              flex: 1, padding: "11px 0", borderRadius: 11, border: "none",
              background: on ? T.card2 : "transparent", color: on ? T.ink : T.mut,
              fontSize: 13, fontWeight: 600, display: "flex", flexDirection: "column", gap: 2,
            }}>
              <span>{a.label}</span>
              <span style={{ fontSize: 10.5, color: on ? T.accent : T.dim, fontWeight: 600 }}>{doneN} / {items.length}</span>
            </button>
          );
        })}
      </div>

      {areaSections(area).map((s) => <SectionCard key={s.id} s={s} state={state} onToggle={toggle} onFlag={toggleFlag} bankTopics={bankTopics} onOpenBank={showBank} T={T} />)}
      {bankLoading && <div style={{ position: "fixed", inset: 0, zIndex: 60, background: T.light ? "rgba(60,45,50,.35)" : "rgba(8,6,4,.6)", display: "grid", placeItems: "center", color: T.mut, fontSize: 13 }}>Opening bank…</div>}
      {openBank && <BankView bank={openBank} stars={state.qbStars || {}} onStar={starQuestion} onUnstar={unstarQuestion} onClose={() => setOpenBank(null)} T={T} />}
      <StruggleBox state={state} persist={persist} struggles={struggles} setStruggles={setStruggles} today={today} T={T} />
    </>
  );
}

function SectionCard({ s, state, onToggle, onFlag, bankTopics, onOpenBank, T }) {
  const [open, setOpen] = useState(s.id === "arith" || s.id === "varc");
  const st = sectionStats(state, s);
  return (
    <div className="card" style={{ overflow: "hidden", border: `1px solid ${st.allDone ? T.gold + "66" : T.line}`, background: st.allDone ? `linear-gradient(150deg, ${T.card2}, ${T.card})` : T.card, boxShadow: st.allDone ? `0 0 28px ${T.accent}22` : "none" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "none", border: "none", color: T.ink, textAlign: "left", padding: "17px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <MiniRing pct={st.pct} done={st.allDone} T={T} />
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 17.5, fontWeight: 600, color: st.allDone ? T.gold : T.ink }}>{s.name}</div>
          <div style={{ fontSize: 11.5, color: T.mut, marginTop: 2 }}>{st.clsDone}/{st.clsTotal} classes{st.setsTotal ? ` · ${st.setsDone}/${st.setsTotal} practice sets` : ""}</div>
        </div>
        {Icon.chevron(open, T.dim)}
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {s.items.map((it) => it.kind === "s"
            ? <SetRow key={it.id} it={it} state={state} onToggle={onToggle} onFlag={onFlag} hasBank={(bankTopics || []).includes(it.id)} onOpenBank={onOpenBank} T={T} />
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
  return (
    <div className={done ? "completed-pop" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 13, background: done ? T.card2 : "transparent", border: `1px solid ${done ? T.accent2 + "40" : "transparent"}` }}>
      <button onClick={() => onToggle(it.id, "v")} style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${done ? T.accent : T.line}`, background: done ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : "transparent", display: "grid", placeItems: "center", boxShadow: done ? `0 0 8px ${T.accent}44` : "none" }}>
        {Icon.check(done ? T.onAccent : "transparent")}
      </button>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: done ? 600 : 500, color: done ? T.gold : T.ink, lineHeight: 1.3 }}>{it.name}</span>
      <button onClick={() => onFlag(it.id)} style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: "transparent", display: "grid", placeItems: "center" }}>
        {state.flags[it.id] ? Icon.bookmarkFill(T.gold) : Icon.bookmark(T.line)}
      </button>
    </div>
  );
}

function SetRow({ it, state, onToggle, onFlag, hasBank, onOpenBank, T }) {
  const v = state.items[it.id] || {};
  const done = itemDone(state, it);
  const pill = (key, label) => (
    <button onClick={() => onToggle(it.id, key)} style={{ padding: "6px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${v[key] ? T.accent : T.line}`, background: v[key] ? (done ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.card2) : "transparent", color: v[key] ? (done ? T.onAccent : T.accent) : T.dim, boxShadow: v[key] ? `0 0 8px ${T.accent}33` : "none" }}>{label}</button>
  );
  return (
    <div className={done ? "completed-pop" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 10px", borderRadius: 13, margin: "2px 0", background: done ? `linear-gradient(90deg, ${T.card2}, ${T.card})` : T.card2, border: `1px solid ${done ? T.gold + "55" : T.line}`, boxShadow: done ? `0 0 16px ${T.accent}22` : "none" }}>
      <span style={{ color: done ? T.gold : T.dim, flexShrink: 0 }}>{Icon.book(done ? T.gold : T.dim)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", color: done ? T.gold : T.dim, fontWeight: 700 }}>{hasBank ? "QUESTION BANK" : "PRACTICE SET"}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: done ? T.gold : T.ink, lineHeight: 1.3 }}>{it.name}</div>
      </div>
      {hasBank ? (
        /* split pill: [ Question Bank | check ] — one capsule, two actions */
        <div style={{ display: "flex", alignItems: "stretch", borderRadius: 99, overflow: "hidden", border: `1px solid ${done ? T.accent : T.line}`, background: done ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : "transparent", boxShadow: done ? `0 0 10px ${T.accent}44` : "none" }}>
          <button onClick={() => onOpenBank(it)} style={{ border: "none", background: "transparent", padding: "7px 13px", fontSize: 11, fontWeight: 700, color: done ? T.onAccent : T.accent }}>
            Question Bank
          </button>
          <div style={{ width: 1, background: done ? T.onAccent + "44" : T.line }} />
          <button onClick={() => onToggle(it.id, "qb")} aria-label="mark bank done" style={{ border: "none", background: "transparent", padding: "0 11px", display: "grid", placeItems: "center" }}>
            {Icon.check(done ? T.onAccent : v.qb ? T.accent : T.dim, 12)}
          </button>
        </div>
      ) : (
        <>{pill("l1", "LOD 1")}{pill("l2", "LOD 2")}</>
      )}
      <button onClick={() => onFlag(it.id)} style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: "transparent", display: "grid", placeItems: "center" }}>
        {state.flags[it.id] ? Icon.bookmarkFill(T.gold) : Icon.bookmark(T.line)}
      </button>
    </div>
  );
}

/* ---------------- Struggle box ---------------- */
const TOPIC_MEMORY_KEY = "catlog_last_topic";

function StruggleBox({ state, persist, struggles, setStruggles, today, T }) {
  const [text, setText] = useState("");
  // topic sticks between filings — she works through one topic at a time,
  // so re-picking it for every question is pure friction
  const [topicId, setTopicId] = useState(() => {
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem(TOPIC_MEMORY_KEY);
    return saved && TOPIC_OPTION_BY_ID[saved] ? saved : "";
  });
  const chooseTopic = (id) => { setTopicId(id); if (id) localStorage.setItem(TOPIC_MEMORY_KEY, id); };
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
    if (!topicId) { setMsg("Pick a topic first"); setTimeout(() => setMsg(""), 2500); return; }
    setBusy(true); setMsg("");
    const id = uid();
    try {
      if (photo) await api.uploadPhoto(id, photo);
      if (ansPhoto) await api.uploadPhoto(`${id}-ans`, ansPhoto);
      const entry = { id, text: text.trim(), topicId, date: today, hasPhoto: !!photo, hasAnsPhoto: !!ansPhoto, answerText: ansText.trim() };
      await api.createStruggle(entry);
      // hand-filed questions default to the medium gap
      await persist(stampItem({ ...state, sched: { ...state.sched, [id]: { p: 2, lapses: 0, due: addDays(today, FIRST_GAP[2]) } } }, "sched", id));
      setStruggles([...struggles, { ...entry, retired: false, lastTried: null, keepCount: 0 }]);
      await persist({ ...state, log: [...state.log, { date: today, type: "struggle" }] });
      setMsg(`Filed under ${topicName(topicId)}`);
    } catch (e) { console.error(e); setMsg("Couldn't save — try again"); }
    setText(""); setAnsText(""); setPhoto(null); setAnsPhoto(null); setShowAns(false); setBusy(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const inputStyle = { width: "100%", background: T.field, border: `1px solid ${T.line}`, borderRadius: 13, padding: 13, fontSize: 13.5, color: T.ink, outline: "none", resize: "none" };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="serif" style={{ fontSize: 17, fontWeight: 600 }}>Stuck on a question?</div>
      <div style={{ fontSize: 12, color: T.mut, margin: "3px 0 12px" }}>Type it or photograph it, pick the topic once, then file as many as you like.</div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.12em", color: T.dim, fontWeight: 700 }}>TOPIC</span>
          {topicId && <span style={{ fontSize: 10, color: T.dim }}>stays selected for the next one</span>}
        </div>
        <select value={topicId} onChange={(e) => chooseTopic(e.target.value)} style={{
          width: "100%", background: T.field, border: `1px solid ${topicId ? T.accent + "66" : T.line}`,
          borderRadius: 12, padding: "12px 10px", fontSize: 13.5, color: topicId ? T.ink : T.dim,
          outline: "none", fontWeight: topicId ? 600 : 400,
        }}>
          <option value="">Choose a topic…</option>
          {SECTIONS.map((sec) => {
            const opts = TOPIC_OPTIONS.filter((t) => t.sectionId === sec.id);
            if (!opts.length) return null;
            return (
              <optgroup key={sec.id} label={sec.name}>
                {opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

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
        <button onClick={submit} disabled={busy || !topicId || (!text.trim() && !photo)} style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 12.5, fontWeight: 700, color: T.onAccent, opacity: busy || !topicId || (!text.trim() && !photo) ? 0.4 : 1, boxShadow: `0 0 18px ${T.accent}44` }}>{busy ? "Filing" : "File it"}</button>
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
  const prioOf = (s) => prioOfItem(state, s);
  const bySection = filter === "all" ? queue : queue.filter((s) => topicSectionId(s.topicId) === filter);
  const [exportScope, setExportScope] = useState("due");
  const [tour, setTour] = useState(false);
  const [tourLeft, setTourLeft] = useState(3);
  useEffect(() => { setTourLeft(Math.max(0, 3 - tutorialViews())); }, []);
  const startTour = () => {
    const n = tutorialViews() + 1;
    localStorage.setItem(TUTORIAL_KEY, String(n));
    setTourLeft(Math.max(0, 3 - n));
    setTour(true);
  };

  const byUrgency = (a, b) => prioOf(b) - prioOf(a) || (dueDate(state, a) < dueDate(state, b) ? -1 : 1);
  const due = bySection.filter((s) => isDue(state, s, today)).sort(byUrgency);
  const upcoming = bySection.filter((s) => !isDue(state, s, today))
    .sort((a, b) => (dueDate(state, a) < dueDate(state, b) ? -1 : 1));
  const filtered = exportScope === "all" ? [...due, ...upcoming] : due;
  const flagged = Object.keys(state.flags).filter((id) => state.flags[id] && ITEM_BY_ID[id]);
  const archive = struggles.filter((s) => s.retired);

  const update = async (id, patch) => {
    setStruggles(struggles.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try { await api.patchStruggle(id, patch); } catch (e) { console.error(e); }
    await persist({ ...state, log: [...state.log, { date: today, type: "revision" }] });
  };
  const retire = (id) => {
    update(id, { retired: true, lastTried: today });
    persist(stampItem({ ...state, sched: { ...state.sched, [id]: null } }, "sched", id));
    if (id.startsWith("qb-")) {
      const qid = id.slice(3);
      persist(stampItem({ ...state, qbStars: { ...state.qbStars, [qid]: 0 } }, "qbStars", qid));
    }
  };
  const keep = (id) => {
    const st = struggles.find((x) => x.id === id);
    update(id, { lastTried: today, keepCount: (st?.keepCount || 0) + 1 });
    // she could not do it: bring it back soon, and treat it as hardest priority
    const cur = (state.sched || {})[id] || { lapses: 0 };
    const lapses = Math.min((cur.lapses || 0) + 1, LAPSE_GAPS.length - 1);
    let next = stampItem({ ...state, sched: { ...state.sched, [id]: { p: 3, lapses, due: addDays(today, LAPSE_GAPS[lapses]) } } }, "sched", id);
    if (id.startsWith("qb-")) next = stampItem({ ...next, qbStars: { ...next.qbStars, [id.slice(3)]: 3 } }, "qbStars", id.slice(3));
    persist(next);
  };
  const reviewEarly = (id) => {
    const nextSched = { ...state.sched, [id]: { ...(state.sched?.[id] || { p: 2, lapses: 0 }), due: today } };
    persist(stampItem({ ...state, sched: nextSched }, "sched", id));
  };
  const unflag = (id) => persist(stampItem({ ...state, flags: { ...state.flags, [id]: false }, log: [...state.log, { date: today, type: "revision", seq: Date.now() }] }, "flags", id));

  const [exportErr, setExportErr] = useState("");
  const doExport = async () => {
    setExporting(true); setExportErr("");
    try { await exportRevisionDoc(filtered, flagged); }
    catch (e) { console.error(e); setExportErr("Couldn't build the PDF — try again."); }
    setExporting(false);
  };

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Revision queue</span>
              {tourLeft > 0 && (
                <button onClick={startTour} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "4px 11px", fontSize: 10.5, fontWeight: 700, color: T.accent }}>
                  Tutorial
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>{due.length} due now · {upcoming.length} scheduled · {flagged.length} bookmarked</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 13, alignItems: "stretch" }}>
          <select data-tour="export" value={exportScope} onChange={(e) => setExportScope(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: T.field, border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 10px", fontSize: 11.5, color: T.mut, outline: "none" }}>
            <option value="due">Due now ({due.length})</option>
            <option value="all">Everything active ({bySection.length})</option>
          </select>
          <button onClick={doExport} disabled={exporting || (filtered.length === 0 && flagged.length === 0)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, flexShrink: 0, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 11, padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: T.onAccent, opacity: exporting || (filtered.length === 0 && flagged.length === 0) ? 0.4 : 1, boxShadow: `0 0 16px ${T.accent}44`, whiteSpace: "nowrap" }}>
            {Icon.download(T.onAccent)} {exporting ? "Building" : "Export PDF"}
          </button>
        </div>
        {exportErr && <div style={{ fontSize: 11.5, color: T.accent2, fontWeight: 600, marginTop: 10 }}>{exportErr}</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {[["all", "All"], ...SECTIONS.map((s) => [s.id, s.name])].map(([k, l]) => {
            const on = filter === k;
            const n = k === "all" ? queue.length : queue.filter((s) => topicSectionId(s.topicId) === k).length;
            return <button key={k} onClick={() => setFilter(k)} style={{ padding: "7px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.card2 : "transparent", color: on ? T.accent : n ? T.mut : T.line }}>{l}{n ? ` · ${n}` : ""}</button>;
          })}
        </div>
      </div>
      {bySection.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut }}>{filter === "all" ? "The queue is empty. Star a question in a Question Bank, or file one from the Study tab." : "Nothing filed under this section."}</div>
      ) : (
        <>
          {due.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div data-tour="due" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: T.accent, fontWeight: 700, margin: "4px 2px 0" }}>DUE NOW · {due.length}</div>
              {due.map((s, idx) => <QueueCard key={s.id} s={s} tourAnchor={idx === 0} prio={prioOf(s)} dueIn={daysUntil(dueDate(state, s), today)} now={now} onRetire={() => retire(s.id)} onKeep={() => keep(s.id)} T={T} />)}
            </div>
          ) : (
            <div className="card" style={{ padding: 22, textAlign: "center" }}>
              <div className="serif" style={{ fontSize: 17, fontWeight: 600, color: T.gold }}>Nothing due today</div>
              <div style={{ fontSize: 12.5, color: T.mut, marginTop: 5, lineHeight: 1.5 }}>
                {upcoming.length ? (() => {
                  const nd = dueDate(state, upcoming[0]);
                  const n = Math.max(0, daysUntil(nd, today));
                  return `${upcoming.length} question${upcoming.length === 1 ? "" : "s"} waiting — the next comes back ${n <= 7 ? `on ${DAY_NAMES[new Date(nd + "T00:00:00").getDay()]}day` : `in ${n} days`}.`;
                })() : "The queue is clear."}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <details className="card" style={{ padding: "4px 0" }}>
              <summary data-tour="upcoming" style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.mut }}>Coming up</span>
                <span style={{ fontSize: 11.5, color: T.dim }}>{upcoming.length} scheduled {Icon.chevron(false, T.dim)}</span>
              </summary>
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.map((s) => {
                  const dd = dueDate(state, s);
                  const d = daysUntil(dd, today);
                  const dayName = DAY_NAMES[new Date(dd + "T00:00:00").getDay()];
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: T.dim }}>
                          {prioOf(s) ? <span style={{ color: T.gold }}>{"★".repeat(prioOf(s))} </span> : null}{topicName(s.topicId).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 12.5, color: T.mut, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text || "photo question"}</div>
                      </div>
                      <span style={{ fontSize: 10.5, color: T.dim, flexShrink: 0, textAlign: "right" }}>{d <= 7 ? dayName : `in ${d}d`}<br /><span style={{ fontSize: 9 }}>in {d}d</span></span>
                      <button onClick={() => reviewEarly(s.id)} style={{ background: "transparent", border: `1px solid ${T.line}`, borderRadius: 99, padding: "6px 11px", fontSize: 10.5, fontWeight: 700, color: T.accent, flexShrink: 0 }}>Review now</button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}

      {tour && <Tutorial onClose={() => setTour(false)} T={T} />}

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
                <span style={{ fontWeight: 700, color: T.dim }}>{topicName(s.topicId)}</span>
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

function QueueCard({ s, prio, dueIn, tourAnchor, now, onRetire, onKeep, T }) {
  const [img, setImg] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [ansImg, setAnsImg] = useState(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { if (s.hasPhoto) fetchPhotoUrl(s.id).then(setImg); return () => img && URL.revokeObjectURL(img); }, [s.id, s.hasPhoto]);
  useEffect(() => { if (reveal && s.hasAnsPhoto && !ansImg) fetchPhotoUrl(`${s.id}-ans`).then(setAnsImg); }, [reveal]);
  const hasAnswer = s.answerText || s.hasAnsPhoto;
  const overdue = typeof dueIn === "number" && dueIn < 0 ? Math.abs(dueIn) : 0;
  const stale = overdue >= 7;

  return (
    <div className="card" {...(tourAnchor ? { "data-tour": "card" } : {})} style={{ padding: 16, border: `1px solid ${stale ? T.accent2 + "80" : T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: "0.08em" }}>{prio ? <span style={{ color: T.gold }}>{"★".repeat(prio)} </span> : null}{topicName(s.topicId).toUpperCase()} · filed {s.date}{s.keepCount > 0 ? ` · kept ${s.keepCount}×` : ""}</div>
        {overdue > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: stale ? T.accent2 : T.gold, letterSpacing: "0.08em", background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "3px 9px", flexShrink: 0 }}>{overdue}D OVERDUE</span>}
      </div>
      {s.text && <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.ink }}>{s.text}</div>}
      {img && (
        <button onClick={() => setLightbox({ src: img, caption: `${topicName(s.topicId)} · filed ${s.date}` })}
          style={{ display: "block", padding: 0, marginTop: 8, border: "none", background: "none", position: "relative", width: "100%", textAlign: "left" }}>
          <img src={img} alt="question" style={{ borderRadius: 10, maxHeight: 220, maxWidth: "100%", border: `1px solid ${T.line}`, display: "block" }} />
          <span style={{ position: "absolute", bottom: 8, right: 8, background: T.light ? "rgba(50,40,42,.72)" : "rgba(8,6,4,.78)", border: `1px solid ${T.line}`, borderRadius: 99, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: T.accent }}>tap to enlarge</span>
        </button>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={onRetire} {...(tourAnchor ? { "data-tour": "clear" } : {})} style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, color: T.onAccent }}>Got it — clear</button>
        <button onClick={onKeep} {...(tourAnchor ? { "data-tour": "keep" } : {})} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 700, color: T.accent }}>Still shaky — again in 2d</button>
        {hasAnswer && !reveal && <button onClick={() => setReveal(true)} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "8px 15px", fontSize: 11.5, fontWeight: 600, color: T.mut }}>Reveal answer</button>}
      </div>
      {reveal && (
        <div style={{ marginTop: 9, padding: 11, background: T.field, borderRadius: 10, border: `1px solid ${T.line}` }}>
          {s.answerText && <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gold }}>{s.answerText}</div>}
          {ansImg && (
            <button onClick={() => setLightbox({ src: ansImg, caption: "Solution" })} style={{ display: "block", padding: 0, marginTop: 5, border: "none", background: "none" }}>
              <img src={ansImg} alt="answer" style={{ borderRadius: 9, maxHeight: 160, maxWidth: "100%", display: "block" }} />
            </button>
          )}
        </div>
      )}
      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} T={T} />}
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
      const binStr = Object.entries(wbins).map(([id, n]) => `${topicName(id)}: ${n}`).join(", ");
      const summary = `Activity events this week: ${acts.length}. Progress: ${perSection}. New struggle notes this week: ${binStr || "none"}. Revision queue size: ${queueN}. Exam Nov 29. Today ${dayKey(now)}.`;
      const r = await api.digest(summary);
      await persist(stampField({ ...state, digest: r.digest, digestDate: dayKey(now) }, "digest"));
      setDigestErr("");
    } catch (e) { console.error(e); setDigestErr("Couldn't reach the AI — try again in a moment."); }
    setDigestBusy(false);
  };

  const setRevDays = (d) => {
    const cur = state.settings.revisionDays;
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].slice(-2);
    if (!next.length) return;
    persist(stampField({ ...state, settings: { ...state.settings, revisionDays: next } }, "settings"));
  };

  return (
    <>
      <PaceAnalyzer state={state} done={done} total={total} expected={expected} tone={tone} cleared={cleared} queueN={queueN} now={now} T={T} />

      <div className="card" style={{ padding: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Sections</div>
        {SECTIONS.map((s) => {
          const st = sectionStats(state, s);
          return (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: st.allDone ? T.gold : T.ink }}>{s.name}</span>
                <span style={{ color: T.dim }}>{st.clsDone}/{st.clsTotal} classes{st.setsTotal ? ` · ${st.setsDone}/${st.setsTotal} sets` : ""}</span>
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
              <span key={id} style={{ padding: "7px 14px", borderRadius: 99, fontWeight: 700, fontSize: clamp(11 + n * 1.2, 11, 17), background: T.card2, color: idx === 0 ? T.accent : T.gold, border: `1px solid ${idx === 0 ? T.accent2 + "80" : T.line}`, boxShadow: idx === 0 ? `0 0 14px ${T.accent}33` : "none" }}>{topicName(id)} · {n}</span>
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
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 12, lineHeight: 1.55 }}>Pick one or two days. Questions become due on these days only — with one day a week everything lands together; with two, the queue spreads out and each question comes back closer to when it was actually ready.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_NAMES.map((d, i) => {
            const on = state.settings.revisionDays.includes(i);
            return <button key={d} onClick={() => setRevDays(i)} style={{ padding: "9px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.card2 : T.card2, color: on ? T.accent : T.mut, boxShadow: on ? `0 0 12px ${T.accent}33` : "none" }}>{d}</button>;
          })}
        </div>
        <div style={{ fontSize: 10, color: T.dim, marginTop: 16 }}>Data lives in your own Supabase project, behind your access code. Photos are private and only ever fetched through the server.</div>
      </div>

      <BankAdminCard T={T} />

      <ResetCard state={state} persist={persist} T={T} />
    </>
  );
}

/* Testing leaves fingerprints: ticked items she didn't do, and celebrations
   already spent. Both are worth clearing before she starts for real. */
function ResetCard({ state, persist, T }) {
  const [confirming, setConfirming] = useState(null); // null | "celebrations" | "all"

  const celebratedCount = Object.values(state.celebrated || {}).filter(Boolean).length;
  const tickedCount = Object.keys(state.items || {}).filter((id) => {
    const v = state.items[id] || {};
    return v.v || v.l1 || v.l2;
  }).length;

  const resetCelebrations = () => {
    let next = { ...state, celebrated: Object.fromEntries(Object.keys(state.celebrated || {}).map((id) => [id, false])) };
    Object.keys(state.celebrated || {}).forEach((id) => { next = stampItem(next, "celebrated", id); });
    persist(next);
    setConfirming(null);
  };

  const resetAll = () => {
    const blank = (obj, v) => Object.fromEntries(Object.keys(obj || {}).map((k) => [k, v]));
    let next = { ...state, items: blank(state.items, {}), flags: blank(state.flags, false), celebrated: blank(state.celebrated, false), log: [] };
    Object.keys(state.items || {}).forEach((id) => { next = stampItem(next, "items", id); });
    Object.keys(state.flags || {}).forEach((id) => { next = stampItem(next, "flags", id); });
    Object.keys(state.celebrated || {}).forEach((id) => { next = stampItem(next, "celebrated", id); });
    persist(next);
    setConfirming(null);
  };

  const btn = (danger) => ({
    background: T.card2, border: `1px solid ${danger ? T.accent2 + "66" : T.line}`,
    borderRadius: 11, padding: "9px 14px", fontSize: 11.5, fontWeight: 700,
    color: danger ? T.accent2 : T.mut,
  });

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Clear test data</div>
      <div style={{ fontSize: 12, color: T.mut, marginBottom: 14, lineHeight: 1.55 }}>
        Anything ticked while setting this up will look like progress she didn't make, and any celebration already triggered won't play again for her. Clear both before handing it over.
      </div>

      {confirming === null && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setConfirming("celebrations")} disabled={!celebratedCount} style={{ ...btn(false), opacity: celebratedCount ? 1 : 0.4 }}>
            Reset celebrations{celebratedCount ? ` (${celebratedCount})` : ""}
          </button>
          <button onClick={() => setConfirming("all")} disabled={!tickedCount && !celebratedCount} style={{ ...btn(true), opacity: (tickedCount || celebratedCount) ? 1 : 0.4 }}>
            Reset all progress{tickedCount ? ` (${tickedCount} ticked)` : ""}
          </button>
        </div>
      )}

      {confirming === "celebrations" && (
        <div style={{ background: T.field, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55, marginBottom: 12 }}>
            Clear {celebratedCount} spent celebration{celebratedCount === 1 ? "" : "s"}? Ticked progress stays exactly as it is — these clusters will simply celebrate again when next completed.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resetCelebrations} style={{ ...btn(false), color: T.accent, borderColor: T.accent }}>Yes, reset them</button>
            <button onClick={() => setConfirming(null)} style={btn(false)}>Cancel</button>
          </div>
        </div>
      )}

      {confirming === "all" && (
        <div style={{ background: T.field, border: `1px solid ${T.accent2}55`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55, marginBottom: 12 }}>
            This wipes every ticked class and practice set ({tickedCount}), all bookmarks, the activity history, and all celebrations — a clean slate. Filed questions, mocks and revision history are <b>not</b> touched. This can't be undone.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resetAll} style={{ ...btn(true), background: T.accent2 + "22" }}>Yes, wipe progress</button>
            <button onClick={() => setConfirming(null)} style={btn(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}


/* Tap any filed photo to view it large. Fit / 2x toggle with scroll, so a
   dense textbook question can actually be read without exporting a PDF. */
function Lightbox({ src, caption, onClose, T }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 80, background: T.light ? "rgba(40,32,34,0.92)" : "rgba(6,5,4,0.94)",
      display: "flex", flexDirection: "column", overscrollBehavior: "contain",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.mut, fontWeight: 600, letterSpacing: "0.06em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{caption}</div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); setZoom((z) => (z === 1 ? 2 : z === 2 ? 3 : 1)); }}
            style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, color: T.accent }}>
            {zoom === 1 ? "Zoom in" : zoom === 2 ? "2x · more" : "3x · reset"}
          </button>
          <button onClick={onClose} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, width: 34, height: 34, fontSize: 16, color: T.mut, lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, overflow: "auto", padding: 12, WebkitOverflowScrolling: "touch" }}>
        <img src={src} alt="filed question" onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          style={{ display: "block", margin: "0 auto", width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "900px" : "none", cursor: "zoom-in", borderRadius: 6 }} />
      </div>
      <div style={{ textAlign: "center", padding: "10px 0 16px", fontSize: 10.5, color: T.dim, flexShrink: 0 }}>tap outside the image to close</div>
    </div>
  );
}

/* ---------------- Cluster completion celebration ---------------- */
function ClusterCelebration({ data, onDone, T }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, []);

  // radial ember burst — three staggered rings of particles so it reads as a
  // spray rather than a single ripple
  const COUNT = 38;
  const particles = Array.from({ length: COUNT }, (_, i) => {
    const ring = i % 3;                       // 0 inner, 1 mid, 2 outer
    const angle = (360 / COUNT) * i * 3 + ring * 14;
    const dist = 54 + ring * 34 + (i % 5) * 8;
    const size = ring === 2 ? 3 : ring === 1 ? 4.5 : 6;
    const delay = ring * 55 + (i % 4) * 22;
    const dur = 1000 + ring * 260;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, size, delay, dur,
      color: i % 3 === 0 ? T.gold : i % 3 === 1 ? T.accent : T.accent2,
    };
  });

  return (
    <button onClick={onDone} aria-label="dismiss" style={{
      position: "fixed", inset: 0, zIndex: 50, border: "none", cursor: "pointer",
      background: T.light ? "rgba(60,45,50,0.36)" : "rgba(8,6,4,0.6)", backdropFilter: "blur(2px)",
      display: "grid", placeItems: "center", padding: 20,
    }}>
      <style>{`
        @keyframes burstOut { 0%{ transform: translate(0,0) scale(.35); opacity:0 } 16%{ opacity:1 } 100%{ transform: translate(var(--dx), var(--dy)) scale(1); opacity:0 } }
        @keyframes ringPulse { 0%{ transform: scale(.6); opacity:0 } 28%{ opacity:.85 } 100%{ transform: scale(1.9); opacity:0 } }
        @keyframes cardPop { 0%{ transform: scale(.93); opacity:0 } 58%{ transform: scale(1.02); opacity:1 } 100%{ transform: scale(1); opacity:1 } }
        @media (prefers-reduced-motion: reduce) { .burst-particle, .burst-ring { animation: none !important; opacity: 0 !important } }
      `}</style>

      <div style={{ position: "relative", width: 1, height: 1 }}>
        <div className="burst-ring" style={{ position: "absolute", left: -70, top: -70, width: 140, height: 140, borderRadius: "50%", border: `2px solid ${T.accent}`, animation: "ringPulse 1.2s ease-out forwards" }} />
        <div className="burst-ring" style={{ position: "absolute", left: -50, top: -50, width: 100, height: 100, borderRadius: "50%", border: `1.5px solid ${T.gold}`, animation: "ringPulse 1.4s ease-out .18s forwards" }} />
        {particles.map((p, i) => (
          <div key={i} className="burst-particle" style={{
            position: "absolute", left: -p.size / 2, top: -p.size / 2, width: p.size, height: p.size,
            borderRadius: "50%", background: p.color, boxShadow: `0 0 9px ${p.color}`,
            "--dx": `${p.x}px`, "--dy": `${p.y}px`,
            animation: `burstOut ${p.dur}ms cubic-bezier(.2,.7,.3,1) ${p.delay}ms forwards`,
          }} />
        ))}
      </div>

      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        position: "relative", padding: "30px 34px", textAlign: "center", maxWidth: 300,
        animation: "cardPop .5s cubic-bezier(.2,.8,.3,1) forwards", border: `1px solid ${T.gold}55`,
        boxShadow: `0 0 50px ${T.accent}33`,
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: T.dim, fontWeight: 700, marginBottom: 10 }}>CLUSTER COMPLETE</div>
        <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: T.gold, lineHeight: 1.25 }}>{data.name}</div>
        <div style={{ fontSize: 12.5, color: T.mut, fontWeight: 500, marginTop: 12, lineHeight: 1.5 }}>Classes and both question sets — all done.</div>
        <div style={{ fontSize: 10.5, color: T.dim, marginTop: 16 }}>tap anywhere to continue</div>
      </div>
    </button>
  );
}

/* ================================================================
   MOCKS — log, score, and (most importantly) analyse
   ================================================================ */
const MOCK_SECTIONS = [
  { id: "varc", name: "VARC", qs: 24 },
  { id: "dilr", name: "DILR", qs: 22 },
  { id: "qa", name: "QA", qs: 22 },
];
/* CAT marking: +3 correct, -1 wrong on MCQ, no negative on TITA. We can't
   know the MCQ/TITA split per attempt, so this is the standard all-MCQ
   estimate — close, but treat it as indicative rather than exact. */
const secScore = (s) => (s.correct || 0) * 3 - Math.max(0, (s.attempted || 0) - (s.correct || 0));
const mockScore = (m) => MOCK_SECTIONS.reduce((a, sec) => a + secScore(m.sections?.[sec.id] || {}), 0);
const secAcc = (s) => (s.attempted ? Math.round(((s.correct || 0) / s.attempted) * 100) : 0);

function Mocks({ state, persist, now, T }) {
  const [adding, setAdding] = useState(false);
  const mocks = [...(state.mocks || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  const addMock = (m) => {
    persist(stampField({ ...state, mocks: [...(state.mocks || []), m], log: [...state.log, { date: dayKey(now), type: "mock", seq: Date.now() }] }, "mocks"));
    setAdding(false);
  };
  const removeMock = (id) => persist(stampField({ ...state, mocks: (state.mocks || []).filter((m) => m.id !== id) }, "mocks"));

  const best = mocks.length ? Math.max(...mocks.map(mockScore)) : 0;
  const latest = mocks.length ? mockScore(mocks[0]) : 0;

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Mock tests</div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 3, lineHeight: 1.5 }}>
              {mocks.length === 0
                ? "From October onward these matter more than syllabus coverage. Attempt strategy and timing are learned here, not in class."
                : `${mocks.length} logged · latest ${latest} · best ${best}`}
            </div>
          </div>
          <button onClick={() => setAdding(!adding)} style={{ background: adding ? T.card2 : `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: adding ? `1px solid ${T.line}` : "none", borderRadius: 11, padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: adding ? T.mut : T.onAccent, flexShrink: 0 }}>
            {adding ? "Cancel" : "Log a mock"}
          </button>
        </div>
      </div>

      {adding && <MockForm onSave={addMock} now={now} T={T} />}

      {mocks.length > 1 && <MockTrend mocks={[...mocks].reverse()} T={T} />}

      {mocks.map((m) => <MockCard key={m.id} m={m} onRemove={() => removeMock(m.id)} T={T} />)}

      {mocks.length === 0 && !adding && (
        <div className="card" style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut, lineHeight: 1.6 }}>
          No mocks logged yet.<br />
          <span style={{ color: T.dim, fontSize: 12 }}>Log the first one whenever she takes it — even a sectional counts.</span>
        </div>
      )}
    </>
  );
}

function MockForm({ onSave, now, T }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(dayKey(now));
  const [rows, setRows] = useState(Object.fromEntries(MOCK_SECTIONS.map((s) => [s.id, { attempted: "", correct: "" }])));
  const [notes, setNotes] = useState("");
  const [percentile, setPercentile] = useState("");

  const setCell = (sec, field, v) => setRows({ ...rows, [sec]: { ...rows[sec], [field]: v.replace(/[^0-9]/g, "") } });

  const valid = MOCK_SECTIONS.every((s) => {
    const r = rows[s.id];
    const a = Number(r.attempted || 0), c = Number(r.correct || 0);
    return c <= a && a <= s.qs;
  });

  const save = () => {
    if (!valid) return;
    onSave({
      id: uid(), name: name.trim() || "Mock", date, notes: notes.trim(), percentile: percentile.trim(),
      sections: Object.fromEntries(MOCK_SECTIONS.map((s) => [s.id, { attempted: Number(rows[s.id].attempted || 0), correct: Number(rows[s.id].correct || 0) }])),
    });
  };

  const input = { background: T.field, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, color: T.ink, outline: "none", width: "100%" };
  const cell = { ...input, textAlign: "center", padding: "8px 4px" };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SIMCAT 3" style={{ ...input, flex: 2 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, flex: 1.4, colorScheme: "dark" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 8px" }}>
        <div style={{ flex: 1, fontSize: 9, letterSpacing: "0.1em", color: T.dim, fontWeight: 700 }}>SECTION</div>
        {["ATTEMPTED", "CORRECT", "SCORE"].map((h) => <div key={h} style={{ width: 68, flexShrink: 0, textAlign: "center", fontSize: 8.5, letterSpacing: "0.06em", color: T.dim, fontWeight: 700 }}>{h}</div>)}
      </div>

      {MOCK_SECTIONS.map((s) => {
        const r = rows[s.id];
        const a = Number(r.attempted || 0), c = Number(r.correct || 0);
        const bad = c > a || a > s.qs;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 10.5, color: T.dim }}>{s.qs} questions</div>
            </div>
            <input value={r.attempted} onChange={(e) => setCell(s.id, "attempted", e.target.value)} placeholder="0" inputMode="numeric" style={{ ...cell, width: 68, flexShrink: 0, borderColor: a > s.qs ? T.accent2 : T.line }} />
            <input value={r.correct} onChange={(e) => setCell(s.id, "correct", e.target.value)} placeholder="0" inputMode="numeric" style={{ ...cell, width: 68, flexShrink: 0, borderColor: bad ? T.accent2 : T.line }} />
            <div style={{ width: 68, flexShrink: 0, textAlign: "center", fontSize: 14, fontWeight: 700, color: bad ? T.accent2 : T.accent }}>
              {bad ? "—" : secScore({ attempted: a, correct: c })}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input value={percentile} onChange={(e) => setPercentile(e.target.value)} placeholder="Percentile (optional)" style={{ ...input, flex: 1 }} />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What went wrong? What to do differently next time? (this is the part that actually improves scores)" style={{ ...input, resize: "none", lineHeight: 1.5 }} />

      {!valid && <div style={{ fontSize: 11.5, color: T.accent2, fontWeight: 600, marginTop: 10 }}>Check the numbers — correct can't exceed attempted, and attempted can't exceed the section total.</div>}

      <button onClick={save} disabled={!valid} style={{ width: "100%", marginTop: 12, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: T.onAccent, opacity: valid ? 1 : 0.4 }}>Save mock</button>
    </div>
  );
}

function MockTrend({ mocks, T }) {
  const scores = mocks.map(mockScore);
  const max = Math.max(...scores, 10);
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="serif" style={{ fontSize: 17, fontWeight: 600, marginBottom: 3 }}>Total score trend</div>
      <div style={{ fontSize: 11.5, color: T.mut, marginBottom: 14 }}>Oldest to newest. Direction matters more than any single score.</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
        {mocks.map((m, i) => {
          const sc = scores[i];
          return (
            <div key={m.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.mut }}>{sc}</div>
              <div title={m.name} style={{ width: "100%", borderRadius: "5px 5px 2px 2px", height: Math.max(6, (sc / max) * 62), background: `linear-gradient(180deg, ${T.accent}, ${T.accent2})`, boxShadow: `0 0 8px ${T.accent}44` }} />
              <div style={{ fontSize: 9, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{m.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MockCard({ m, onRemove, T }) {
  const [open, setOpen] = useState(false);
  const total = mockScore(m);
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "none", border: "none", color: T.ink, textAlign: "left", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{m.date}{m.percentile ? ` · ${m.percentile} %ile` : ""}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: T.accent }}>{total}</div>
          <div style={{ fontSize: 8.5, letterSpacing: "0.12em", color: T.dim, fontWeight: 700 }}>SCORE</div>
        </div>
        {Icon.chevron(open, T.dim)}
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
            {MOCK_SECTIONS.map((s) => {
              const r = m.sections?.[s.id] || {};
              return (
                <div key={s.id} style={{ flex: 1, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, textAlign: "center" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", color: T.dim, fontWeight: 700 }}>{s.name}</div>
                  <div className="serif" style={{ fontSize: 19, fontWeight: 700, color: T.gold, marginTop: 4 }}>{secScore(r)}</div>
                  <div style={{ fontSize: 10.5, color: T.mut, marginTop: 3 }}>{r.correct || 0}/{r.attempted || 0} · {secAcc(r)}%</div>
                </div>
              );
            })}
          </div>
          {m.notes && (
            <div style={{ background: T.field, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
              <div style={{ fontSize: 9.5, letterSpacing: "0.12em", color: T.dim, fontWeight: 700, marginBottom: 6 }}>TAKEAWAYS</div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.notes}</div>
            </div>
          )}
          <button onClick={onRemove} style={{ marginTop: 12, background: "none", border: "none", fontSize: 11, color: T.dim, fontWeight: 600, padding: 0 }}>Delete this mock</button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   PACE ANALYZER — collapsed by default. Opens only when asked.
   ================================================================ */
function PaceAnalyzer({ state, done, total, expected, tone, cleared, queueN, now, T }) {
  const [open, setOpen] = useState(false);

  /* Projection uses recent behaviour, not lifetime average, because a slow
     first fortnight shouldn't haunt the estimate forever. We measure items
     completed in the last 21 days and extrapolate. */
  const proj = (() => {
    // only count timestamps for items that are STILL completed — unticking
    // during testing used to leave a stale stamp and inflate the rate
    const stamps = Object.entries(state.meta?.items || {})
      .filter(([id, t]) => t && ITEM_BY_ID[id] && itemDone(state, ITEM_BY_ID[id]))
      .map(([, t]) => t)
      .sort((a, b) => a - b);
    if (stamps.length < 3) return { ok: false, reason: "Not enough activity yet — a few more days of data will make this meaningful." };

    const windowMs = 21 * 864e5;
    const cutoff = now.getTime() - windowMs;
    const recent = stamps.filter((t) => t >= cutoff);
    const firstEver = stamps[0];
    const spanDays = Math.max(1, (now.getTime() - Math.max(firstEver, cutoff)) / 864e5);
    const perDay = recent.length / spanDays;

    if (perDay <= 0.01) return { ok: false, reason: "No items completed in the last three weeks, so there's no current pace to project from." };

    const remaining = total - done;
    const daysNeeded = Math.ceil(remaining / perDay);
    const finish = new Date(now.getTime() + daysNeeded * 864e5);
    const daysToExam = Math.ceil((EXAM_DATE - now) / 864e5);
    return {
      ok: true, perDay, daysNeeded, finish, remaining,
      beatsExam: daysNeeded <= daysToExam,
      slackDays: daysToExam - daysNeeded,
    };
  })();

  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="card" style={{ padding: open ? 20 : 0, overflow: "hidden" }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{
          width: "100%", background: "none", border: "none", color: T.ink,
          padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left",
        }}>
          <div>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Pace analyzer</div>
            <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>Projected finish date and current rate. Hidden until you ask.</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.accent, border: `1px solid ${T.line}`, borderRadius: 99, padding: "7px 14px", flexShrink: 0 }}>Analyze</span>
        </button>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Pace analyzer</div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 11.5, color: T.dim, fontWeight: 600 }}>Hide</button>
          </div>

          {proj.ok ? (
            <>
              <div style={{ background: T.field, border: `1px solid ${T.line}`, borderRadius: 16, padding: "20px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 9.5, letterSpacing: "0.18em", color: T.dim, fontWeight: 700 }}>AT THE CURRENT RATE, DONE BY</div>
                <div className="serif" style={{ fontSize: 27, fontWeight: 600, color: proj.beatsExam ? T.gold : T.accent2, margin: "9px 0 4px" }}>
                  {fmt(proj.finish)}
                </div>
                <div style={{ fontSize: 12, color: T.mut, fontWeight: 500 }}>
                  {proj.beatsExam
                    ? `${proj.slackDays} day${proj.slackDays === 1 ? "" : "s"} of room before the exam`
                    : `${Math.abs(proj.slackDays)} day${Math.abs(proj.slackDays) === 1 ? "" : "s"} past the exam at this rate`}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Stat label="CURRENT RATE" value={`${proj.perDay.toFixed(1)}`} sub="items / day" T={T} />
                <Stat label="REMAINING" value={`${proj.remaining}`} sub={`of ${total}`} T={T} />
                <Stat label="VS PLAN" value={done >= expected ? `+${done - expected}` : `${done - expected}`} sub="items" T={T} color={tone.c} />
              </div>

              {!proj.beatsExam && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: T.mut, lineHeight: 1.55, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
                  To land it by Nov 8 she'd need about{" "}
                  <span style={{ color: T.ink, fontWeight: 700 }}>
                    {(proj.remaining / Math.max(1, Math.ceil((TARGET - now) / 864e5))).toFixed(1)}
                  </span>{" "}
                  items a day. Worth deciding whether to raise the rate or trim what's in scope — both are reasonable answers.
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: T.mut, lineHeight: 1.6, background: T.field, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
              {proj.reason}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: T.mut, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}` }}>
              Expected by today: ~{expected} · Actual: <span style={{ color: T.ink, fontWeight: 700 }}>{done}</span>
            </div>
            <div style={{ flex: 1, fontSize: 12.5, color: T.mut, background: T.card2, borderRadius: 12, padding: 12, border: `1px solid ${T.line}` }}>
              Revision: <span style={{ color: T.ink, fontWeight: 700 }}>{cleared}</span> cleared · {queueN} queued
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: T.dim, marginTop: 12, lineHeight: 1.5 }}>
            Projection is based on the last three weeks of activity, so it moves as she does. Early on it swings wildly — treat it as a direction, not a deadline.
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, T, color }) {
  return (
    <div style={{ flex: 1, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 8.5, letterSpacing: "0.12em", color: T.dim, fontWeight: 700 }}>{label}</div>
      <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: color || T.ink, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.mut, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

/* ================================================================
   QUESTION BANK VIEWER
   ================================================================ */
const DIFF_ORDER = ["easy", "medium", "hard"];
const DIFF_LABEL = { easy: "Warm-up", medium: "Core", hard: "Stretch" };

function BankView({ bank, stars, onStar, onUnstar, onClose, T }) {
  const [starPicker, setStarPicker] = useState(null); // question id | null
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);

  const groups = DIFF_ORDER.map((d) => ({ d, qs: bank.questions.filter((q) => q.difficulty === d) })).filter((g) => g.qs.length);
  const starredN = bank.questions.filter((q) => stars[q.id]).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: T.bgGrad, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 600, color: T.ink }}>{bank.name}</div>
          <div style={{ fontSize: 11.5, color: T.mut, marginTop: 2 }}>{bank.questions.length} questions{starredN ? ` · ${starredN} starred for revision` : ""} · answers in the book</div>
        </div>
        <button onClick={onClose} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 99, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: T.mut, flexShrink: 0 }}>Close</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 60px", WebkitOverflowScrolling: "touch" }}>
        {groups.map(({ d, qs }) => (
          <div key={d} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 2px 10px" }}>
              <span className="serif" style={{ fontSize: 16, fontWeight: 600, color: d === "hard" ? T.accent2 : d === "medium" ? T.accent : T.good }}>{DIFF_LABEL[d]}</span>
              <span style={{ fontSize: 11, color: T.dim }}>{qs.length} · {d}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {qs.map((q, i) => {
                const starred = stars[q.id];
                return (
                  <div key={q.id} className="card" style={{ padding: 14, border: `1px solid ${starred ? T.gold + "55" : T.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: T.dim }}>
                        {i + 1}. {q.type ? q.type.toUpperCase() : ""}
                      </div>
                      <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        {starred ? (
                          <>
                            {/* tap the stars to change grade, ✕ to clear outright */}
                            <button onClick={() => setStarPicker(starPicker === q.id ? null : q.id)}
                              style={{ background: T.card2, border: `1px solid ${T.gold}55`, borderRadius: 99, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1 }}>
                              {"★".repeat(starred)}
                            </button>
                            <button onClick={() => onUnstar(q)} aria-label="remove from revision"
                              style={{ background: "transparent", border: `1px solid ${T.line}`, borderRadius: 99, width: 26, height: 26, fontSize: 14, lineHeight: 1, color: T.mut, display: "grid", placeItems: "center", padding: 0 }}>
                              ×
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setStarPicker(starPicker === q.id ? null : q.id)}
                            style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 99, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, color: T.dim }}>
                            ☆ revise
                          </button>
                        )}
                        {starPicker === q.id && (
                          <div className="card" style={{ position: "absolute", right: 0, top: 30, zIndex: 5, padding: 7, display: "flex", flexDirection: "column", gap: 5, whiteSpace: "nowrap", minWidth: 152 }}>
                            {[[3, "★★★", "revisit first · 2d"], [2, "★★", "soon · 4d"], [1, "★", "eventually · 7d"]].map(([p, stars2, hint]) => (
                              <button key={p} onClick={() => { onStar(q, p); setStarPicker(null); }}
                                style={{ background: starred === p ? T.card2 : "transparent", border: `1px solid ${starred === p ? T.gold + "66" : T.line}`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: T.gold, fontWeight: 700, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span>{stars2}</span><span style={{ color: T.dim, fontWeight: 600, fontSize: 10 }}>{hint}</span>
                              </button>
                            ))}
                            {starred ? (
                              <button onClick={() => { onUnstar(q); setStarPicker(null); }}
                                style={{ background: "transparent", border: `1px solid ${T.line}`, borderRadius: 9, padding: "7px 10px", fontSize: 11, color: T.mut, fontWeight: 700 }}>
                                Remove from revision
                              </button>
                            ) : null}
                            <button onClick={() => setStarPicker(null)} style={{ background: "none", border: "none", fontSize: 10.5, color: T.dim, padding: "2px 0 0" }}>cancel</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: T.ink }}>{q.stem}</div>
                    {Object.keys(q.options || {}).length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px", marginTop: 10 }}>
                        {Object.entries(q.options).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 12.5, color: T.mut }}><span style={{ color: T.dim, fontWeight: 700 }}>({k})</span> {v}</div>
                        ))}
                      </div>
                    )}
                    {q.source && <div style={{ fontSize: 9.5, color: T.dim, marginTop: 9 }}>{q.source}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: 11, color: T.dim, marginTop: 8, lineHeight: 1.6 }}>
          Solve on paper, check answers in the book.<br />Star anything worth revisiting — it joins the revision queue automatically.
        </div>
      </div>
    </div>
  );
}

/* Quiet admin corner: upload the curated question-bank JSON per topic.
   Collapsed by default so it never clutters the dashboard. */
function BankAdminCard({ T }) {
  const [topicId, setTopicId] = useState("");
  const [existing, setExisting] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const refresh = () => api.listBanks().then((r) => setExisting(r.topics || [])).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !topicId) { setMsg("Pick a topic first, then choose the file."); return; }
    setBusy(true); setMsg("");
    try {
      const raw = JSON.parse(await f.text());
      let qs = Array.isArray(raw) ? raw : raw.questions || [];
      // combined multi-chapter files: keep only this topic's questions if tagged
      const tName = TOPIC_OPTION_BY_ID[topicId]?.name;
      if (qs.some((q) => q.chapter) && tName) {
        const subset = qs.filter((q) => (q.chapter || "").toLowerCase() === tName.toLowerCase());
        if (subset.length) qs = subset;
      }
      if (!qs.length) { setMsg("No questions found for this topic in that file."); setBusy(false); return; }
      const r = await api.putBank(topicId, qs);
      setMsg(`Saved ${r.count} questions to ${tName}.`);
      refresh();
    } catch (err) {
      console.error(err);
      setMsg("That file couldn't be read — is it the JSON I generated?");
    }
    setBusy(false);
  };

  return (
    <details className="card" style={{ padding: "4px 0" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
        <span className="serif" style={{ fontSize: 16, fontWeight: 600 }}>Question banks</span>
        <span style={{ fontSize: 11, color: T.dim }}>{existing.length} loaded {Icon.chevron(false, T.dim)}</span>
      </summary>
      <div style={{ padding: "4px 20px 18px" }}>
        <div style={{ fontSize: 12, color: T.mut, marginBottom: 12, lineHeight: 1.5 }}>Upload the curated JSON for a topic. The topic's row on the Study tab switches from LOD pills to a Question Bank automatically.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ flex: 1, minWidth: 170, background: T.field, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 10px", fontSize: 12.5, color: topicId ? T.ink : T.dim, outline: "none" }}>
            <option value="">Choose topic…</option>
            {TOPIC_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.sectionName} — {t.name}{existing.includes(t.id) ? " ✓" : ""}</option>)}
          </select>
          <button onClick={() => fileRef.current.click()} disabled={busy || !topicId} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 15px", fontSize: 12, fontWeight: 700, color: topicId ? T.accent : T.dim, opacity: busy ? 0.5 : 1 }}>
            {busy ? "Uploading…" : "Choose JSON"}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, fontWeight: 600, color: msg.startsWith("Saved") ? T.good : T.accent2, marginTop: 10 }}>{msg}</div>}
        {existing.length > 0 && (
          <div style={{ fontSize: 11, color: T.dim, marginTop: 12 }}>
            Loaded: {existing.map((id) => TOPIC_OPTION_BY_ID[id]?.name || id).join(", ")}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={upload} />
    </details>
  );
}

/* ================================================================
   TUTORIAL — spotlight coach marks. Available three times, then gone.
   ================================================================ */
const TUTORIAL_KEY = "catlog_tutorial_views";
const tutorialViews = () => Number(localStorage.getItem(TUTORIAL_KEY) || 0);

const TOUR = [
  { sel: '[data-tour="due"]', title: "Start here",
    body: "These are the questions due today. They appear when enough time has passed for forgetting to be a real test — not the day after you filed them." },
  { sel: '[data-tour="card"]', title: "Work one, then judge it",
    body: "Solve it on paper first. The stars show how hard you found it, and any overdue days show here too." },
  { sel: '[data-tour="clear"]', title: "Got it",
    body: "Tap this when you solved it comfortably. It leaves the queue for good." },
  { sel: '[data-tour="keep"]', title: "Didn't get it",
    body: "Tap this instead and it returns in two days, marked as hardest so it sits at the top next time. Keep missing it and it comes back again — that's intended." },
  { sel: '[data-tour="upcoming"]', title: "Coming up",
    body: "Everything scheduled for later sits in here, quietly. Open it any time and tap Review now to pull something forward." },
  { sel: '[data-tour="export"]', title: "Take it off-screen",
    body: "Exports what's due as a PDF with working space under each question — useful for a proper sit-down revision session away from the iPad." },
];

function Tutorial({ onClose, T }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const steps = TOUR.filter((s) => document.querySelector(s.sel));

  useEffect(() => {
    if (!steps.length) return;
    const el = document.querySelector(steps[i].sel);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const t = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [i, steps.length]);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  if (!steps.length) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(20,15,14,.86)", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ padding: 24, maxWidth: 320, textAlign: "center" }}>
          <div className="serif" style={{ fontSize: 18, fontWeight: 600, color: T.ink }}>Nothing to point at yet</div>
          <div style={{ fontSize: 13, color: T.mut, marginTop: 8, lineHeight: 1.55 }}>Star a question in a Question Bank first, then come back — the walkthrough highlights real things on this screen.</div>
          <button onClick={onClose} style={{ marginTop: 16, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 11, padding: "10px 20px", fontSize: 12.5, fontWeight: 700, color: T.onAccent }}>Close</button>
        </div>
      </div>
    );
  }

  const pad = 8;
  const step = steps[i];
  const below = rect ? rect.top < window.innerHeight * 0.5 : true;
  const tipTop = rect ? (below ? rect.top + rect.height + pad + 14 : Math.max(16, rect.top - pad - 190)) : 120;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90 }}>
      {/* dim everything except the highlighted element */}
      {rect ? (
        <div style={{
          position: "fixed", top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 14, boxShadow: "0 0 0 9999px rgba(16,12,12,.82)",
          border: `2px solid ${T.accent}`, pointerEvents: "none", transition: "all .28s ease",
        }} />
      ) : <div style={{ position: "fixed", inset: 0, background: "rgba(16,12,12,.82)" }} />}

      {/* arrow */}
      {rect && (
        <svg width="26" height="26" viewBox="0 0 26 26" style={{
          position: "fixed", left: Math.min(window.innerWidth - 44, rect.left + rect.width / 2 - 13),
          top: below ? rect.top + rect.height + pad - 2 : rect.top - pad - 24,
          transform: below ? "none" : "rotate(180deg)", transition: "all .28s ease", pointerEvents: "none",
        }}>
          <path d="M13 24 L4 8 H22 Z" fill={T.accent} />
        </svg>
      )}

      <div className="card" style={{
        position: "fixed", left: 16, right: 16, top: tipTop, maxWidth: 380, margin: "0 auto",
        padding: "18px 20px", border: `1px solid ${T.accent}55`, transition: "top .28s ease",
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: "0.16em", color: T.dim, fontWeight: 700 }}>STEP {i + 1} OF {steps.length}</div>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, color: T.ink, margin: "6px 0 6px" }}>{step.title}</div>
        <div style={{ fontSize: 13, color: T.mut, lineHeight: 1.6 }}>{step.body}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 11.5, color: T.dim, fontWeight: 600, padding: 0 }}>Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            {i > 0 && <button onClick={() => setI(i - 1)} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, color: T.mut }}>Back</button>}
            <button onClick={() => (i === steps.length - 1 ? onClose() : setI(i + 1))}
              style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 700, color: T.onAccent }}>
              {i === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
