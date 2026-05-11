import { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

/* ═══════════════════════════════════════════════════════════
   CollaDO — Dashboard  ·  FUNKY FANCY EDITION
   All Firebase logic, state, effects & calculations
   are 100% preserved. Pure visual overhaul.
   ═══════════════════════════════════════════════════════════ */

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function dateKey(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function getFirstDay(y,m){return new Date(y,m,1).getDay();}

/* ── SVG Ring ── */
function Ring({ pct, size, stroke, color, trackColor = "rgba(255,255,255,0.06)" }) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", display:"block", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }}/>
    </svg>
  );
}

/* ── Color palette ── */
const C = {
  safe:    "#34d399",
  warn:    "#fbbf24",
  danger:  "#f87171",
  violet:  "#a78bfa",
  pink:    "#f472b6",
  blue:    "#60a5fa",
  orange:  "#fb923c",
};

// Per-subject color rotation
const SUBJ_COLORS = [
  { ring: C.safe,   glow: "rgba(52,211,153,0.25)",   pill: "rgba(52,211,153,0.12)",   border: "rgba(52,211,153,0.3)",   text: C.safe   },
  { ring: C.blue,   glow: "rgba(96,165,250,0.25)",   pill: "rgba(96,165,250,0.12)",   border: "rgba(96,165,250,0.3)",   text: C.blue   },
  { ring: C.pink,   glow: "rgba(244,114,182,0.25)",  pill: "rgba(244,114,182,0.12)",  border: "rgba(244,114,182,0.3)",  text: C.pink   },
  { ring: C.orange, glow: "rgba(251,146,60,0.25)",   pill: "rgba(251,146,60,0.12)",   border: "rgba(251,146,60,0.3)",   text: C.orange },
  { ring: C.violet, glow: "rgba(167,139,250,0.25)",  pill: "rgba(167,139,250,0.12)",  border: "rgba(167,139,250,0.3)",  text: C.violet },
  { ring: C.warn,   glow: "rgba(251,191,36,0.25)",   pill: "rgba(251,191,36,0.12)",   border: "rgba(251,191,36,0.3)",   text: C.warn   },
];

function ringColor(pct, target) {
  if (pct >= target)           return C.safe;
  if (pct >= target - 10)      return C.warn;
  return C.danger;
}

export default function Dashboard({ user, onNavigate }) {
  const uid      = user.uid;
  const today    = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const subjCol = collection(db, "users", uid, "subjects");
  const calCol  = collection(db, "users", uid, "calendar");

  /* ── All original state ── */
  const [subjects,         setSubjects]         = useState([]);
  const [calData,          setCalData]           = useState({});
  const [calYear,          setCalYear]           = useState(today.getFullYear());
  const [calMonth,         setCalMonth]          = useState(today.getMonth());
  const [selDay,           setSelDay]            = useState(null);
  const [newName,          setNewName]           = useState("");
  const [showAdd,          setShowAdd]           = useState(false);
  const [calIn,            setCalIn]             = useState(false);
  const [menuOpen,         setMenuOpen]          = useState(false);
  const [target,           setTarget]            = useState(75);
  const [showTargetModal,  setShowTargetModal]   = useState(false);
  const [targetInput,      setTargetInput]       = useState("75");
  const [exams,            setExams]             = useState(() => {
    try {
      const saved = localStorage.getItem(`ktu_exams_${uid}`);
      return saved ? JSON.parse(saved) : [
        { id:1, label:"Series 1", date:"" },
        { id:2, label:"Series 2", date:"" },
        { id:3, label:"Lab Exam", date:"" },
      ];
    } catch {
      return [{ id:1, label:"Series 1", date:"" },{ id:2, label:"Series 2", date:"" },{ id:3, label:"Lab Exam", date:"" }];
    }
  });
  const [showExamEdit, setShowExamEdit] = useState(false);
  const [examDrafts,   setExamDrafts]   = useState([]);

  /* ── All original effects ── */
  useEffect(()=>{ const t=setTimeout(()=>setCalIn(true),100); return()=>clearTimeout(t); },[]);
  useEffect(()=>onSnapshot(subjCol,snap=>setSubjects(snap.docs.map(d=>({id:d.id,...d.data()})))),[uid]);
  useEffect(()=>onSnapshot(calCol,snap=>{const obj={};snap.docs.forEach(d=>{obj[d.id]=d.data();});setCalData(obj);}),[uid]);
  useEffect(()=>{
    const settingsDoc = doc(db,"users",uid,"settings","preferences");
    return onSnapshot(settingsDoc,(snap)=>{
      if(snap.exists()){ setTarget(snap.data().attendanceTarget ?? 75); }
      else { setShowTargetModal(true); }
    });
  },[uid]);

  /* ── All original calculations ── */
  const attendance = useCallback(()=>{
    const map={};
    subjects.forEach(s=>{ map[s.id]={present:0,total:0}; });
    Object.values(calData).forEach(dayObj=>{
      Object.entries(dayObj).forEach(([sid,status])=>{
        if(!map[sid]) return;
        if(status==="P"){ map[sid].present++; map[sid].total++; }
        if(status==="A"){ map[sid].total++; }
      });
    });
    return map;
  },[subjects,calData])();

  function pctFor(sid){
    const { present, total } = attendance[sid] || { present:0, total:0 };
    return total===0 ? 0 : Math.round((present/total)*100);
  }
  function canSkip(sid){
    const { present, total } = attendance[sid] || { present:0, total:0 };
    let s=0; while(Math.round((present/(total+s+1))*100) >= target) s++; return s;
  }
  function needMore(sid){
    const { present, total } = attendance[sid] || { present:0, total:0 };
    if (pctFor(sid) >= target) return 0;
    let e=0; while(Math.round(((present+e)/(total+e))*100) < target) e++; return e;
  }

  const overallPct = subjects.length
    ? Math.round(subjects.reduce((a,s)=>a+pctFor(s.id),0)/subjects.length) : 0;
  const safe = overallPct >= target;

  async function markDay(dk, sid, status){
    await setDoc(doc(db,"users",uid,"calendar",dk),{ ...(calData[dk]||{}), [sid]:status },{ merge:true });
  }
  async function addSubject(){
    if(!newName.trim()) return;
    await setDoc(doc(subjCol),{ name:newName.trim() });
    setNewName(""); setShowAdd(false);
  }
  async function deleteSubject(sid){
    await deleteDoc(doc(db,"users",uid,"subjects",sid));
  }
  function saveExams(drafts){
    setExams(drafts);
    localStorage.setItem(`ktu_exams_${uid}`,JSON.stringify(drafts));
    setShowExamEdit(false);
  }
  async function saveTarget(){
    const val=parseInt(targetInput);
    if(isNaN(val)||val<1||val>100) return;
    await setDoc(doc(db,"users",uid,"settings","preferences"),{ attendanceTarget:val },{ merge:true });
    setTarget(val);
    setShowTargetModal(false);
  }

  function dayCompletion(dk){
    const d = calData[dk]; if(!d) return null;
    const active = Object.entries(d).filter(([,v])=>v==="P"||v==="A");
    if(!active.length) return null;
    return Math.round(active.filter(([,v])=>v==="P").length / active.length * 100);
  }
  function dayDotColor(comp){
    if(comp===null) return null;
    if(comp===100)  return C.safe;
    if(comp>=60)    return C.warn;
    return C.danger;
  }

  const selKey      = selDay ? dateKey(calYear, calMonth, selDay) : null;
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDay(calYear, calMonth);

  const now = new Date(); now.setHours(0,0,0,0);
  const upcoming = exams.filter(e=>e.date).map(e=>{
    const d = new Date(e.date+"T00:00:00");
    return { ...e, diff: Math.ceil((d - now)/86400000) };
  }).filter(e=>e.diff>=0).sort((a,b)=>a.diff-b.diff);
  const nextExam = upcoming[0];
  const danger   = overallPct < target && nextExam && nextExam.diff <= 14;

  const overallRingColor = ringColor(overallPct, target);

  /* ─────────── STYLES ─────────── */
  const S = {
    page:    { minHeight:"100vh", background:"#07070f", color:"#fff",
               fontFamily:"'Outfit', sans-serif", width:"100%", overflowX:"hidden" },
    topbar:  { position:"sticky", top:0, zIndex:50,
               background:"rgba(7,7,15,0.88)", backdropFilter:"blur(20px)",
               borderBottom:"1px solid rgba(255,255,255,0.06)",
               display:"flex", alignItems:"center", gap:12,
               padding:"0 16px", height:56 },
    main:    { width:"100%", maxWidth:820, margin:"0 auto",
               padding:"20px clamp(14px,4vw,40px) 80px" },
    card:    { background:"#0f0f1c", borderRadius:20,
               border:"1px solid rgba(255,255,255,0.07)", marginBottom:12 },
  };

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{width:100%;background:#07070f;overflow-x:hidden;}

        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.6)}to{opacity:1;transform:scale(1)}}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}

        .fu{animation:fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;}
        .fu1{animation-delay:.05s}
        .fu2{animation-delay:.10s}
        .fu3{animation-delay:.15s}
        .fu4{animation-delay:.20s}
        .day-pop{animation:popIn 0.2s cubic-bezier(.34,1.56,.64,1) both;}

        .hov-lift{transition:transform .15s,box-shadow .15s;}
        .hov-lift:hover{transform:translateY(-1px);}

        .btn-base{cursor:pointer;font-family:inherit;transition:all .15s;outline:none;border:none;}
        .del-x{background:transparent;border:none;cursor:pointer;color:rgba(255,255,255,.15);font-size:15px;padding:2px 5px;transition:color .15s;}
        .del-x:hover{color:#f87171;}

        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#1f1f35;border-radius:4px;}

        @media(max-width:500px){
          .hide-sm{display:none!important;}
          .mark-full{display:none!important;}
          .mark-short{display:inline!important;}
        }
        @media(min-width:501px){.mark-short{display:none!important;}}
      `}</style>

      {/* ═══════════ TOPBAR ═══════════ */}
      <header style={S.topbar}>
        {/* Hamburger */}
        <button
          onClick={()=>setMenuOpen(o=>!o)}
          className="btn-base"
          style={{ width:36, height:36, borderRadius:10,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:4 }}
        >
          {[14,10,6].map((w,i)=>(
            <span key={i} style={{ display:"block", width:w, height:1.5,
              background:"rgba(255,255,255,0.5)", borderRadius:2,
              transition:"all .25s",
              transform: menuOpen
                ? i===0 ? "rotate(45deg) translate(3.5px,3.5px)"
                : i===2 ? "rotate(-45deg) translate(3.5px,-3.5px)" : "scaleX(0)"
                : "none",
              opacity: menuOpen && i===1 ? 0 : 1 }}/>
          ))}
        </button>

        {/* Wordmark — gradient */}
        <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
          <span style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.6px",
            background:"linear-gradient(100deg,#a78bfa 0%,#f472b6 55%,#fb923c 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            CollaDO
          </span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,.2)",
            fontWeight:600, letterSpacing:"0.12em" }}>
            .track
          </span>
        </div>

        {/* Right: status pill + sign out */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700,
            background: safe ? "rgba(52,211,153,.12)" : "rgba(248,113,113,.12)",
            border:`1px solid ${safe ? "rgba(52,211,153,.3)" : "rgba(248,113,113,.3)"}`,
            color: safe ? C.safe : C.danger }}>
            {overallPct}% {safe ? "✓" : "⚠"}
          </div>
          <button onClick={()=>signOut(auth)} className="btn-base hide-sm" style={{
            padding:"5px 12px", borderRadius:9, fontSize:12, fontWeight:600,
            background:"transparent", border:"1px solid rgba(255,255,255,.08)",
            color:"rgba(255,255,255,.35)" }}
            onMouseOver={e=>{e.currentTarget.style.color=C.danger;e.currentTarget.style.borderColor="rgba(248,113,113,.3)";}}
            onMouseOut={e=>{e.currentTarget.style.color="rgba(255,255,255,.35)";e.currentTarget.style.borderColor="rgba(255,255,255,.08)";}}>
            Sign out
          </button>
        </div>
      </header>

      {/* ═══════════ DRAWER ═══════════ */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200, animation:"overlayIn .2s ease both" }}
          onClick={()=>setMenuOpen(false)}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(10px)" }}/>
          <aside onClick={e=>e.stopPropagation()} style={{
            position:"absolute", left:0, top:0, height:"100%", width:270,
            background:"#0b0b18", borderRight:"1px solid rgba(255,255,255,.07)",
            display:"flex", flexDirection:"column", animation:"slideIn .3s cubic-bezier(.22,1,.36,1) both" }}>

            {/* Drawer header */}
            <div style={{ padding:"28px 22px 20px",
              background:"linear-gradient(160deg,rgba(167,139,250,.1),rgba(244,114,182,.05))",
              borderBottom:"1px solid rgba(255,255,255,.05)" }}>
              <p style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.5px",
                background:"linear-gradient(100deg,#a78bfa,#f472b6,#fb923c)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>CollaDO</p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,.25)", marginTop:4,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</p>
            </div>

            {/* Nav */}
            <div style={{ flex:1, padding:"16px 12px" }}>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em",
                textTransform:"uppercase", color:"rgba(255,255,255,.2)",
                padding:"0 10px", marginBottom:8 }}>Navigate</p>
              {[
                { label:"Dashboard", page:"dashboard", color:C.violet, symbol:"◈" },
                { label:"Tasks",     page:"reminders", color:C.blue,   symbol:"◆" },
                { label:"Pomodoro",  page:"pomodoro",  color:C.pink,   symbol:"◎" },
              ].map(item=>(
                <button key={item.page} className="btn-base" style={{
                  width:"100%", padding:"11px 12px", borderRadius:10,
                  background:"transparent", color:"rgba(255,255,255,.4)",
                  fontSize:14, fontWeight:500, textAlign:"left",
                  display:"flex", alignItems:"center", gap:12, marginBottom:2 }}
                  onClick={()=>{ setMenuOpen(false); onNavigate?.(item.page); }}
                  onMouseOver={e=>{ e.currentTarget.style.background=`${item.color}18`; e.currentTarget.style.color="#fff"; }}
                  onMouseOut={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,.4)"; }}>
                  <span style={{ color:item.color, fontSize:17 }}>{item.symbol}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Bottom */}
            <div style={{ padding:"14px 12px", borderTop:"1px solid rgba(255,255,255,.05)" }}>
              <button className="btn-base" style={{
                width:"100%", padding:"10px 14px", borderRadius:10, marginBottom:8,
                background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.2)",
                color:"rgba(255,255,255,.4)", fontSize:13, fontWeight:500,
                textAlign:"left", display:"flex", alignItems:"center" }}
                onClick={()=>{ setTargetInput(String(target)); setShowTargetModal(true); setMenuOpen(false); }}
                onMouseOver={e=>{ e.currentTarget.style.color=C.violet; }}
                onMouseOut={e=>{ e.currentTarget.style.color="rgba(255,255,255,.4)"; }}>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em",
                  textTransform:"uppercase", color:"rgba(255,255,255,.2)" }}>Target</span>
                <span style={{ marginLeft:"auto", color:C.violet, fontWeight:800, fontSize:15 }}>{target}%</span>
              </button>
              <button className="btn-base" style={{
                width:"100%", padding:"10px 14px", borderRadius:10,
                background:"rgba(248,113,113,.06)", border:"1px solid rgba(248,113,113,.2)",
                color:"#f87171", fontSize:13, fontWeight:600 }}
                onClick={()=>signOut(auth)}
                onMouseOver={e=>e.currentTarget.style.background="rgba(248,113,113,.12)"}
                onMouseOut={e=>e.currentTarget.style.background="rgba(248,113,113,.06)"}>
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ═══════════ MAIN ═══════════ */}
      <main style={S.main}>

        {/* ── HERO: Overall ── */}
        <div className="fu" style={{ ...S.card,
          padding:"22px 22px",
          background:"linear-gradient(135deg,#0f0f1c 0%,#130e1e 60%,#0c0f1a 100%)",
          border:"1px solid rgba(167,139,250,.18)",
          display:"flex", alignItems:"center", gap:20,
          position:"relative", overflow:"hidden" }}>
          {/* bg glow */}
          <div style={{ position:"absolute", right:-50, top:-50, width:220, height:220,
            borderRadius:"50%", pointerEvents:"none",
            background:`radial-gradient(circle,${safe?"rgba(52,211,153,.09)":"rgba(248,113,113,.09)"} 0%,transparent 70%)` }}/>

          {/* Huge % text */}
          <div style={{ flexShrink:0 }}>
            <div style={{ fontSize:"clamp(52px,13vw,76px)", fontWeight:900,
              letterSpacing:"-4px", lineHeight:1,
              color: overallRingColor,
              textShadow:`0 0 48px ${overallRingColor}55` }}>
              {overallPct}<span style={{ fontSize:"clamp(22px,5vw,34px)", fontWeight:700, letterSpacing:"-1px" }}>%</span>
            </div>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em",
              textTransform:"uppercase", color:"rgba(255,255,255,.25)", marginTop:4 }}>
              Overall
            </p>
          </div>

          {/* Status */}
          <div style={{ flex:1, zIndex:1 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:7,
              padding:"5px 12px", borderRadius:20, marginBottom:10,
              background: safe ? "rgba(52,211,153,.1)" : "rgba(248,113,113,.1)",
              border:`1px solid ${safe ? "rgba(52,211,153,.28)" : "rgba(248,113,113,.28)"}` }}>
              <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                background: safe ? C.safe : C.danger,
                boxShadow:`0 0 8px ${safe ? C.safe : C.danger}` }}/>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
                textTransform:"uppercase",
                color: safe ? C.safe : C.danger }}>
                {safe ? "You're safe" : "At risk"}
              </span>
            </div>
            <p style={{ fontSize:16, fontWeight:700, lineHeight:1.3, marginBottom:5 }}>
              {safe ? "Keep the streak going." : "Attend more sessions."}
            </p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.38)", lineHeight:1.5 }}>
              {safe
                ? `${overallPct - target}% above your ${target}% target — you can relax.`
                : `${target - overallPct}% short of ${target}% — focus this week.`}
            </p>
            <button className="btn-base" style={{ marginTop:10, fontSize:11,
              color:"rgba(255,255,255,.25)", textDecoration:"underline",
              textDecorationColor:"rgba(255,255,255,.1)", background:"transparent" }}
              onClick={()=>{ setTargetInput(String(target)); setShowTargetModal(true); }}>
              Change target ({target}%)
            </button>
          </div>

          {/* Ring */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <Ring pct={overallPct} size={78} stroke={6} color={overallRingColor}/>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:12, fontWeight:800, color:overallRingColor }}>
              {overallPct}%
            </div>
          </div>
        </div>

        {/* ── EXAM COUNTDOWN ── */}
        <div className="fu fu1" style={{ ...S.card,
          padding:"18px 20px",
          background: danger
            ? "linear-gradient(135deg,#1c0808,#13060a)"
            : "linear-gradient(135deg,#0c1120,#0a0d1a)",
          border:`1px solid ${danger ? "rgba(248,113,113,.3)" : "rgba(96,165,250,.18)"}`,
          position:"relative", overflow:"hidden" }}>

          <div style={{ position:"absolute", left:-30, bottom:-30, width:160, height:160,
            borderRadius:"50%", pointerEvents:"none",
            background:`radial-gradient(circle,${danger?"rgba(248,113,113,.09)":"rgba(96,165,250,.07)"} 0%,transparent 70%)` }}/>

          <div style={{ display:"flex", alignItems:"center",
            justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em",
              textTransform:"uppercase", color:"rgba(255,255,255,.22)" }}>Upcoming Exams</span>
            <button className="btn-base" style={{
              padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:600,
              background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)",
              color:"rgba(255,255,255,.3)" }}
              onClick={()=>{ setExamDrafts(JSON.parse(JSON.stringify(exams))); setShowExamEdit(true); }}
              onMouseOver={e=>{ e.currentTarget.style.color=C.violet; e.currentTarget.style.borderColor="rgba(167,139,250,.3)"; }}
              onMouseOut={e=>{ e.currentTarget.style.color="rgba(255,255,255,.3)"; e.currentTarget.style.borderColor="rgba(255,255,255,.09)"; }}>
              Edit dates
            </button>
          </div>

          {nextExam ? (
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", zIndex:1, position:"relative" }}>
              {/* Countdown box */}
              <div style={{ width:76, height:76, borderRadius:18, flexShrink:0,
                background: danger ? "rgba(248,113,113,.1)" : "rgba(96,165,250,.08)",
                border:`1px solid ${danger ? "rgba(248,113,113,.3)" : "rgba(96,165,250,.2)"}`,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:30, fontWeight:900, lineHeight:1,
                  color: danger ? C.danger : C.blue,
                  textShadow:`0 0 24px ${danger ? C.danger : C.blue}88` }}>{nextExam.diff}</span>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.18em",
                  textTransform:"uppercase", color:"rgba(255,255,255,.25)", marginTop:2 }}>days</span>
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:15, fontWeight:700, marginBottom:5 }}>
                  {nextExam.label}
                  <span style={{ color:"rgba(255,255,255,.32)", fontWeight:400 }}>
                    {" · "}{nextExam.diff===0?"today":nextExam.diff===1?"tomorrow":`in ${nextExam.diff} days`}
                  </span>
                </p>
                <p style={{ fontSize:12, fontWeight:600,
                  color: danger ? C.danger : safe ? C.safe : C.warn }}>
                  {danger
                    ? `⚠ ${overallPct}% — exam block risk!`
                    : safe ? `✓ ${overallPct}% — you're clear`
                    : `${overallPct}% — stay consistent`}
                </p>
                {upcoming.length > 1 && (
                  <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                    {upcoming.slice(1).map(e=>(
                      <span key={e.id} style={{ fontSize:11, fontWeight:500,
                        padding:"3px 10px", borderRadius:20,
                        background:"rgba(255,255,255,.04)",
                        border:"1px solid rgba(255,255,255,.08)",
                        color: e.diff<=7 ? C.danger : e.diff<=14 ? C.warn : "rgba(255,255,255,.4)" }}>
                        {e.label} · {e.diff===0?"today":`${e.diff}d`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button className="btn-base" style={{
              width:"100%", padding:"14px 18px", borderRadius:14, textAlign:"left",
              background:"rgba(255,255,255,.02)", border:"1px dashed rgba(255,255,255,.1)",
              color:"rgba(255,255,255,.25)", fontSize:13, fontWeight:500 }}
              onClick={()=>{ setExamDrafts(JSON.parse(JSON.stringify(exams))); setShowExamEdit(true); }}
              onMouseOver={e=>{ e.currentTarget.style.borderColor="rgba(167,139,250,.35)"; e.currentTarget.style.color=C.violet; }}
              onMouseOut={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; e.currentTarget.style.color="rgba(255,255,255,.25)"; }}>
              + Set series exam dates →
            </button>
          )}
        </div>

        {/* ── BUNK PLANNER ── */}
        {subjects.length > 0 && (
          <div className="fu fu2" style={{ ...S.card, padding:"20px" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:12, flexShrink:0,
                background:"linear-gradient(135deg,rgba(167,139,250,.2),rgba(244,114,182,.15))",
                border:"1px solid rgba(167,139,250,.2)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🛌</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700 }}>Bunk Planner</p>
                <p style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginTop:1 }}>exactly how many you can skip</p>
              </div>
              {/* Total badge */}
              <div style={{ padding:"6px 14px", borderRadius:20,
                background: subjects.every(s=>pctFor(s.id)>=target)
                  ? "rgba(52,211,153,.1)" : "rgba(248,113,113,.08)",
                border:`1px solid ${subjects.every(s=>pctFor(s.id)>=target)
                  ? "rgba(52,211,153,.25)" : "rgba(248,113,113,.2)"}` }}>
                <span style={{ fontSize:18, fontWeight:900,
                  color: subjects.every(s=>pctFor(s.id)>=target) ? C.safe : C.danger }}>
                  {subjects.reduce((acc,s)=>{
                    const{present,total}=attendance[s.id]||{present:0,total:0};
                    let skip=0;
                    while(Math.round((present/(total+skip+1))*100)>=target)skip++;
                    return acc+skip;
                  },0)}
                </span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,.3)", fontWeight:500, marginLeft:4 }}>skippable</span>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {subjects.map((s,i)=>{
                const { present, total } = attendance[s.id] || { present:0, total:0 };
                const p  = pctFor(s.id);
                const skip = canSkip(s.id);
                const need = needMore(s.id);
                const isSafe = p >= target;
                const atLimit = isSafe && skip === 0;
                const sc = SUBJ_COLORS[i % SUBJ_COLORS.length];
                return (
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"12px 14px", borderRadius:14,
                    background:"rgba(255,255,255,.025)",
                    border:"1px solid rgba(255,255,255,.05)" }}>
                    {/* Color dot */}
                    <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                      background:sc.ring, boxShadow:`0 0 8px ${sc.ring}` }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</p>
                      <p style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginTop:1 }}>
                        {present}/{total} · {p}%
                      </p>
                    </div>
                    <div style={{ flexShrink:0 }}>
                      {isSafe && skip > 0 && (
                        <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px",
                          borderRadius:20, background:"rgba(52,211,153,.1)",
                          border:"1px solid rgba(52,211,153,.25)", color:C.safe }}>
                          skip {skip} ✓
                        </span>
                      )}
                      {atLimit && (
                        <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px",
                          borderRadius:20, background:"rgba(251,191,36,.1)",
                          border:"1px solid rgba(251,191,36,.25)", color:C.warn }}>
                          at limit ⚡
                        </span>
                      )}
                      {!isSafe && (
                        <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px",
                          borderRadius:20, background:"rgba(248,113,113,.1)",
                          border:"1px solid rgba(248,113,113,.25)", color:C.danger }}>
                          +{need} needed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUBJECTS ── */}
        <div>
          <div style={{ display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 4px", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em",
              textTransform:"uppercase", color:"rgba(255,255,255,.22)" }}>Subjects</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,.25)" }}>{subjects.length} tracked</span>
          </div>

          {subjects.map((s,i)=>{
            const p      = pctFor(s.id);
            const isSafe = p >= target;
            const rc     = ringColor(p, target);
            const { present, total } = attendance[s.id] || { present:0, total:0 };
            const cur    = (calData[todayKey] || {})[s.id] || "N";
            const sc     = SUBJ_COLORS[i % SUBJ_COLORS.length];

            return (
              <div key={s.id} className="fu hov-lift"
                style={{ ...S.card, overflow:"hidden",
                  animationDelay:`${0.15 + i * 0.07}s` }}>
                {/* Colored top bar */}
                <div style={{ height:3,
                  background:`linear-gradient(90deg,${sc.ring} 0%,${C.pink} 60%,transparent 100%)` }}/>

                <div style={{ padding:"14px 16px 0" }}>
                  {/* Header row */}
                  <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
                    {/* Ring */}
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <Ring pct={p} size={54} stroke={5} color={rc}/>
                      <div style={{ position:"absolute", inset:0, display:"flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:9, fontWeight:800, color:rc }}>{p}%</div>
                    </div>

                    {/* Name + stat */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.2px",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {s.name}
                      </p>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,.35)" }}>{present}/{total}</span>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px",
                          borderRadius:20, background:sc.pill,
                          border:`1px solid ${sc.border}`, color:sc.text }}>
                          {isSafe
                            ? canSkip(s.id) > 0 ? `skip ${canSkip(s.id)}` : "at limit"
                            : `need ${needMore(s.id)}`}
                        </span>
                      </div>
                    </div>

                    <button className="del-x" onClick={()=>deleteSubject(s.id)}>✕</button>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:3, background:"rgba(255,255,255,.05)",
                    borderRadius:3, marginBottom:12, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:3, width:`${p}%`,
                      background:`linear-gradient(90deg,${sc.ring},${rc})`,
                      transition:"width .5s ease" }}/>
                  </div>
                </div>

                {/* Mark buttons */}
                <div style={{ padding:"10px 16px 14px",
                  borderTop:"1px solid rgba(255,255,255,.04)",
                  display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.18em",
                    textTransform:"uppercase", color:"rgba(255,255,255,.18)",
                    flexShrink:0, marginRight:4 }}>Today</span>

                  {[
                    { val:"P", full:"Present", short:"P",
                      activeStyle:{ background:"linear-gradient(135deg,#052e16,#064e3b)",
                        border:"1px solid #059669", color:C.safe,
                        boxShadow:"0 0 14px rgba(5,150,105,.35)" } },
                    { val:"A", full:"Absent", short:"A",
                      activeStyle:{ background:"linear-gradient(135deg,#2d0a0a,#450a0a)",
                        border:"1px solid #dc2626", color:C.danger,
                        boxShadow:"0 0 14px rgba(220,38,38,.3)" } },
                    { val:"N", full:"No class", short:"—",
                      activeStyle:{ background:"rgba(255,255,255,.08)",
                        border:"1px solid rgba(255,255,255,.2)", color:"rgba(255,255,255,.7)",
                        boxShadow:"none" } },
                  ].map(btn=>{
                    const active = cur === btn.val;
                    return (
                      <button key={btn.val} className="btn-base hov-lift" style={{
                        flex:1, padding:"8px 4px", borderRadius:10, fontSize:12, fontWeight:600,
                        textAlign:"center", transition:"all .15s",
                        ...(active ? btn.activeStyle : {
                          background:"rgba(255,255,255,.03)",
                          border:"1px solid rgba(255,255,255,.07)",
                          color:"rgba(255,255,255,.28)" }) }}
                        onClick={()=>markDay(todayKey, s.id, btn.val)}>
                        <span className="mark-full">{btn.full}</span>
                        <span className="mark-short">{btn.short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add subject */}
          <div style={{ ...S.card, padding:16 }}>
            {showAdd ? (
              <div>
                <input autoFocus value={newName}
                  onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter" && addSubject()}
                  placeholder="e.g. Engineering Maths"
                  style={{ width:"100%", padding:"11px 14px", marginBottom:10,
                    background:"rgba(255,255,255,.04)",
                    border:"1px solid rgba(167,139,250,.25)",
                    borderRadius:10, color:"#fff", fontSize:14,
                    fontFamily:"inherit", fontWeight:500, outline:"none" }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-base" style={{ flex:1, padding:11, borderRadius:10,
                    background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                    border:"none", color:"#fff", fontWeight:700, fontSize:13,
                    boxShadow:"0 4px 18px rgba(124,58,237,.4)" }}
                    onClick={addSubject}>
                    Add Subject
                  </button>
                  <button className="btn-base" style={{ padding:"11px 16px", borderRadius:10,
                    background:"transparent", border:"1px solid rgba(255,255,255,.09)",
                    color:"rgba(255,255,255,.4)", fontSize:13 }}
                    onClick={()=>{ setShowAdd(false); setNewName(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-base" style={{ width:"100%", padding:"14px",
                borderRadius:14, background:"rgba(167,139,250,.03)",
                border:"1px dashed rgba(167,139,250,.2)",
                color:"rgba(167,139,250,.45)", fontSize:13, fontWeight:600 }}
                onClick={()=>setShowAdd(true)}
                onMouseOver={e=>{ e.currentTarget.style.background="rgba(167,139,250,.08)";
                  e.currentTarget.style.color=C.violet;
                  e.currentTarget.style.borderColor="rgba(167,139,250,.4)"; }}
                onMouseOut={e=>{ e.currentTarget.style.background="rgba(167,139,250,.03)";
                  e.currentTarget.style.color="rgba(167,139,250,.45)";
                  e.currentTarget.style.borderColor="rgba(167,139,250,.2)"; }}>
                + Add Subject
              </button>
            )}
          </div>
        </div>

        {/* ── CALENDAR ── */}
        <div style={{ ...S.card, overflow:"hidden",
          opacity:calIn ? 1 : 0, transition:"opacity .4s ease" }}>
          {/* Cal header with gradient bg */}
          <div style={{ padding:"16px 18px 14px",
            background:"linear-gradient(135deg,rgba(167,139,250,.07),rgba(244,114,182,.04))",
            borderBottom:"1px solid rgba(255,255,255,.05)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              {[
                { dir:"prev", label:"‹", action:()=>{ setSelDay(null); if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); } },
                null,
                { dir:"next", label:"›", action:()=>{ setSelDay(null); if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); } },
              ].map((item,idx)=> item ? (
                <button key={item.dir} className="btn-base" style={{
                  width:32, height:32, borderRadius:9,
                  background:"rgba(255,255,255,.04)",
                  border:"1px solid rgba(255,255,255,.08)",
                  color:"rgba(255,255,255,.4)", fontSize:17,
                  display:"flex", alignItems:"center", justifyContent:"center" }}
                  onClick={item.action}
                  onMouseOver={e=>{ e.currentTarget.style.background="rgba(167,139,250,.12)"; e.currentTarget.style.color=C.violet; }}
                  onMouseOut={e=>{ e.currentTarget.style.background="rgba(255,255,255,.04)"; e.currentTarget.style.color="rgba(255,255,255,.4)"; }}>
                  {item.label}
                </button>
              ) : (
                <div key="mid" style={{ textAlign:"center" }}>
                  <p style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.2px" }}>
                    {MONTHS[calMonth]}
                    <span style={{ color:"rgba(255,255,255,.35)", fontWeight:400, marginLeft:6 }}>{calYear}</span>
                  </p>
                  <p style={{ fontSize:10, color:"rgba(255,255,255,.2)", marginTop:1 }}>tap a day to log attendance</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding:"12px 14px 18px" }}>
            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
              {DAYS_SHORT.map(d=>(
                <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700,
                  letterSpacing:"0.08em", textTransform:"uppercase",
                  color:"rgba(255,255,255,.18)", padding:"3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Days */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
              {Array.from({ length: firstDay }).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({ length: daysInMonth }).map((_,i)=>{
                const day  = i + 1;
                const dk   = dateKey(calYear, calMonth, day);
                const comp = dayCompletion(dk);
                const dc   = dayDotColor(comp);
                const isToday = dk === todayKey;
                const isSel   = selDay === day;
                return (
                  <button key={day} className="btn-base day-pop"
                    style={{ animationDelay:`${i * 10}ms`,
                      aspectRatio:"1", borderRadius:10, position:"relative",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center",
                      fontSize:"clamp(9px,2.5vw,11px)", fontWeight: isSel||isToday ? 700 : 400,
                      border:`1px solid ${
                        isSel   ? "rgba(167,139,250,.5)"
                        : isToday ? "rgba(255,255,255,.22)"
                        : "rgba(255,255,255,.05)"}`,
                      background: isSel   ? "rgba(167,139,250,.16)"
                        : isToday ? "rgba(255,255,255,.06)"
                        : "transparent",
                      color: isSel   ? C.violet
                        : isToday ? "#fff"
                        : "rgba(255,255,255,.42)",
                      boxShadow: isSel ? "0 0 14px rgba(167,139,250,.2)" : "none" }}
                    onClick={()=>setSelDay(isSel ? null : day)}>
                    {day}
                    {dc && (
                      <span style={{ position:"absolute", bottom:3, width:4, height:4,
                        borderRadius:"50%", background:dc,
                        boxShadow:`0 0 5px ${dc}` }}/>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", alignItems:"center", gap:14,
              marginTop:14, paddingTop:12,
              borderTop:"1px solid rgba(255,255,255,.04)", justifyContent:"center" }}>
              <span style={{ fontSize:10, color:"rgba(255,255,255,.2)", marginRight:4 }}>Attendance</span>
              {[[C.safe,"Full"],[C.warn,"Partial"],[C.danger,"Low"]].map(([c,l])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:c,
                    boxShadow:`0 0 6px ${c}`, display:"inline-block" }}/>
                  <span style={{ fontSize:10, color:"rgba(255,255,255,.3)", fontWeight:500 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DAY DETAIL ── */}
        {selDay && selKey && (
          <div className="fu" style={{ ...S.card, padding:"16px 18px",
            border:"1px solid rgba(167,139,250,.2)",
            boxShadow:"0 0 28px rgba(167,139,250,.08)" }}>
            <div style={{ display:"flex", alignItems:"center",
              justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em",
                  textTransform:"uppercase", color:"rgba(255,255,255,.22)", marginBottom:4 }}>
                  Mark attendance
                </p>
                <p style={{ fontSize:16, fontWeight:800, letterSpacing:"-0.3px" }}>
                  {MONTHS[calMonth]} {selDay}, {calYear}
                </p>
              </div>
              <button className="del-x" style={{ fontSize:18 }}
                onClick={()=>setSelDay(null)}>✕</button>
            </div>
            {subjects.length===0 && <p style={{ fontSize:12, color:"rgba(255,255,255,.3)" }}>No subjects yet.</p>}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {subjects.map((s,i)=>{
                const cur = (calData[selKey]||{})[s.id] || "N";
                const sc  = SUBJ_COLORS[i % SUBJ_COLORS.length];
                return (
                  <div key={s.id} style={{ display:"flex", alignItems:"center",
                    gap:10, padding:"10px 12px", borderRadius:12,
                    background:"rgba(255,255,255,.025)",
                    border:"1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ width:6, height:6, borderRadius:"50%",
                      background:sc.ring, flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:13, fontWeight:500,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.name}
                    </span>
                    <div style={{ display:"flex", gap:4 }}>
                      {[
                        { val:"P", icon:"✓", ac:{ background:"linear-gradient(135deg,#052e16,#064e3b)", border:"1px solid #059669", color:C.safe } },
                        { val:"A", icon:"✗", ac:{ background:"linear-gradient(135deg,#2d0a0a,#450a0a)", border:"1px solid #dc2626", color:C.danger } },
                        { val:"N", icon:"—", ac:{ background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.2)", color:"rgba(255,255,255,.7)" } },
                      ].map(btn=>{
                        const active = cur === btn.val;
                        return (
                          <button key={btn.val} className="btn-base" style={{
                            width:34, height:34, borderRadius:8, fontSize:13, fontWeight:700,
                            ...(active ? btn.ac : {
                              background:"rgba(255,255,255,.03)",
                              border:"1px solid rgba(255,255,255,.07)",
                              color:"rgba(255,255,255,.25)" }) }}
                            onClick={()=>markDay(selKey, s.id, btn.val)}>
                            {btn.icon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* ═══════════ EXAM EDIT MODAL ═══════════ */}
      {showExamEdit && (
        <div style={{ position:"fixed", inset:0, zIndex:200,
          background:"rgba(0,0,0,.82)", backdropFilter:"blur(14px)",
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:20, animation:"overlayIn .2s ease both" }}
          onClick={()=>setShowExamEdit(false)}>
          <div className="fu" style={{ width:"100%", maxWidth:360,
            background:"#0f0f1e", border:"1px solid rgba(167,139,250,.22)",
            borderRadius:22, padding:24,
            boxShadow:"0 0 60px rgba(167,139,250,.12)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"flex-start",
              justifyContent:"space-between", marginBottom:18 }}>
              <div>
                <p style={{ fontSize:17, fontWeight:800, letterSpacing:"-0.3px" }}>Exam Dates</p>
                <p style={{ fontSize:12, color:"rgba(255,255,255,.3)", marginTop:3 }}>Set your series schedule</p>
              </div>
              <button className="del-x" style={{ fontSize:18 }}
                onClick={()=>setShowExamEdit(false)}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:18 }}>
              {examDrafts.map((exam,i)=>(
                <div key={exam.id}>
                  <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em",
                    textTransform:"uppercase", color:"rgba(255,255,255,.35)",
                    display:"block", marginBottom:6 }}>{exam.label}</label>
                  <input type="date" value={exam.date}
                    onChange={e=>{ const d=[...examDrafts]; d[i]={...d[i],date:e.target.value}; setExamDrafts(d); }}
                    style={{ width:"100%", padding:"10px 14px",
                      background:"rgba(255,255,255,.04)",
                      border:"1px solid rgba(255,255,255,.1)", borderRadius:10,
                      color:"#fff", fontSize:13, fontFamily:"inherit",
                      outline:"none", colorScheme:"dark" }}
                    onFocus={e=>e.currentTarget.style.borderColor="rgba(167,139,250,.4)"}
                    onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.1)"}/>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn-base" style={{ flex:1, padding:12,
                background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                border:"none", borderRadius:10, color:"#fff",
                fontWeight:800, fontSize:13,
                boxShadow:"0 4px 18px rgba(124,58,237,.4)" }}
                onClick={()=>saveExams(examDrafts)}>Save dates</button>
              <button className="btn-base" style={{ padding:"12px 16px", borderRadius:10,
                background:"transparent", border:"1px solid rgba(255,255,255,.09)",
                color:"rgba(255,255,255,.4)", fontSize:13 }}
                onClick={()=>setShowExamEdit(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TARGET MODAL ═══════════ */}
      {showTargetModal && (
        <div style={{ position:"fixed", inset:0, zIndex:200,
          background:"rgba(0,0,0,.82)", backdropFilter:"blur(14px)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="fu" style={{ width:"100%", maxWidth:360,
            background:"#0f0f1e", border:"1px solid rgba(167,139,250,.22)",
            borderRadius:22, padding:24,
            boxShadow:"0 0 60px rgba(167,139,250,.12)" }}>
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:17, fontWeight:800, letterSpacing:"-0.3px" }}>Attendance Target</p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,.3)", marginTop:3 }}>
                Different colleges have different requirements.
              </p>
            </div>
            {/* Preset buttons */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
              {[75,80,85].map(v=>{
                const active = targetInput === String(v);
                return (
                  <button key={v} className="btn-base" style={{ padding:"13px 4px",
                    borderRadius:12, fontSize:16, fontWeight:900,
                    background: active ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.03)",
                    border:`1px solid ${active ? "rgba(167,139,250,.45)" : "rgba(255,255,255,.09)"}`,
                    color: active ? C.violet : "rgba(255,255,255,.4)",
                    boxShadow: active ? "0 0 16px rgba(167,139,250,.2)" : "none" }}
                    onClick={()=>setTargetInput(String(v))}>
                    {v}%
                  </button>
                );
              })}
            </div>
            <input type="number" min={1} max={100} value={targetInput}
              onChange={e=>setTargetInput(e.target.value)}
              placeholder="Custom %"
              style={{ width:"100%", padding:"10px 14px", marginBottom:16,
                background:"rgba(255,255,255,.04)",
                border:"1px solid rgba(255,255,255,.1)", borderRadius:10,
                color:"#fff", fontSize:13, fontFamily:"inherit",
                outline:"none", colorScheme:"dark" }}
              onFocus={e=>e.currentTarget.style.borderColor="rgba(167,139,250,.4)"}
              onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.1)"}/>
            <button className="btn-base" style={{ width:"100%", padding:13,
              background:"linear-gradient(135deg,#7c3aed,#a855f7)",
              border:"none", borderRadius:11, color:"#fff",
              fontWeight:800, fontSize:14,
              boxShadow:"0 4px 20px rgba(124,58,237,.45)" }}
              onClick={saveTarget}>
              Save & continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}