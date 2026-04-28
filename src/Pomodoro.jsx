import { useState, useEffect, useRef } from "react";

const DEFAULT_MODES = [
  { key:"focus",  label:"Focus",       minutes:25, color:"#4ade80" },
  { key:"short",  label:"Short Break", minutes:5,  color:"#38bdf8" },
  { key:"long",   label:"Long Break",  minutes:15, color:"#a78bfa" },
];

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function Ring({ pct, size, stroke, color }) {
  const r   = (size - stroke*2) / 2;
  const c   = 2 * Math.PI * r;
  const off = c - (pct/100)*c;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", display:"block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#141414" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset 0.5s ease" }}/>
    </svg>
  );
}

export default function Pomodoro({ onNavigate }) {
  const [modes,    setModes]    = useState(DEFAULT_MODES);
  const [modeIdx,  setModeIdx]  = useState(0);
  const [seconds,  setSeconds]  = useState(DEFAULT_MODES[0].minutes * 60);
  const [running,  setRunning]  = useState(false);
  const [sessions, setSessions] = useState(0);
  const [cycles,   setCycles]   = useState(0);
  const [log,      setLog]      = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editVals, setEditVals] = useState({
    focus: DEFAULT_MODES[0].minutes,
    short: DEFAULT_MODES[1].minutes,
    long:  DEFAULT_MODES[2].minutes,
  });
  const intervalRef = useRef(null);

  const mode  = modes[modeIdx];
  const total = mode.minutes * 60;
  const pct   = ((total - seconds) / total) * 100;
  const ringSize = Math.min(260, window.innerWidth - 80);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            handleComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, modeIdx]);

  function handleComplete() {
    const now = new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
    if (modeIdx === 0) {
      const newSessions = sessions + 1;
      setSessions(newSessions);
      setLog(l => [`✓ Focus session — ${now}`, ...l].slice(0, 20));
      if (newSessions % 4 === 0) {
        setCycles(c => c + 1);
        switchMode(2);
      } else {
        switchMode(1);
      }
    } else {
      setLog(l => [`☕ Break ended — ${now}`, ...l].slice(0, 20));
      switchMode(0);
    }
  }

  function switchMode(idx) {
    setModeIdx(idx);
    setSeconds(modes[idx].minutes * 60);
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setSeconds(mode.minutes * 60);
  }

  function skipToNext() {
    setRunning(false);
    switchMode(modeIdx === 0 ? 1 : 0);
  }

  function saveSettings() {
    const updated = [
      { ...modes[0], minutes: Math.max(1, Math.min(90, Number(editVals.focus))) },
      { ...modes[1], minutes: Math.max(1, Math.min(30, Number(editVals.short))) },
      { ...modes[2], minutes: Math.max(1, Math.min(60, Number(editVals.long)))  },
    ];
    setModes(updated);
    setSeconds(updated[modeIdx].minutes * 60);
    setRunning(false);
    setShowEdit(false);
  }

  function clampEdit(key, val) {
    setEditVals(e => ({ ...e, [key]: parseInt(val) || 1 }));
  }

  function openEdit() {
    setEditVals({ focus: modes[0].minutes, short: modes[1].minutes, long: modes[2].minutes });
    setShowEdit(true);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#070707",
      fontFamily:"'Outfit',sans-serif", color:"#fff",
      width:"100%", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeIn    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes panelSlide{ from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        .fade-in  { animation: fadeIn 0.35s cubic-bezier(.22,1,.36,1) both; }
        .mode-btn:hover { opacity:0.8; }
        .ctrl-btn:hover { filter:brightness(1.3); }
        .log-item { animation: fadeIn 0.3s ease both; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity:1; }
      `}</style>

      {/* Topbar */}
      <header style={{ width:"100%", display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"13px 16px",
        borderBottom:"1px solid #111", background:"#0a0a0a",
        position:"sticky", top:0, zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <button onClick={()=>onNavigate("dashboard")} style={{
            background:"transparent", border:"none", color:"#444",
            cursor:"pointer", fontSize:"18px", padding:"2px 6px" }}>←</button>
          <span style={{ fontSize:"16px", fontWeight:800, letterSpacing:"-0.8px" }}>
            CollaDO<span style={{ color:"#282828", fontWeight:500 }}>.focus</span>
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {sessions > 0 && (
            <span style={{ background:"#1a1a1a", border:"1px solid #222",
              color:"#4ade80", fontSize:"11px", fontWeight:700,
              padding:"3px 10px", borderRadius:"20px" }}>
              {sessions} done
            </span>
          )}
          <button onClick={openEdit} style={{
            background:"transparent", border:"1px solid #1a1a1a",
            color:"#444", padding:"5px 12px", borderRadius:"6px",
            cursor:"pointer", fontSize:"12px", fontWeight:600,
            fontFamily:"inherit",
          }}>⏱ Edit</button>
        </div>
      </header>

      {/* Edit Modal */}
      {showEdit && (
        <div style={{
          position:"fixed", inset:0, background:"#000000cc", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:"20px", animation:"overlayIn 0.2s ease both",
        }} onClick={()=>setShowEdit(false)}>
          <div style={{
            background:"#0f0f0f", border:"1px solid #1e1e1e",
            borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"380px",
            animation:"panelSlide 0.25s cubic-bezier(.22,1,.36,1) both",
          }} onClick={e=>e.stopPropagation()}>
            <p style={{ fontWeight:800, fontSize:"16px", marginBottom:"4px" }}>Edit Timer</p>
            <p style={{ color:"#2a2a2a", fontSize:"11px", marginBottom:"20px" }}>
              Changes apply after saving. Timer will reset.
            </p>

            {[
              { key:"focus", label:"Focus Session", color:"#4ade80", max:90 },
              { key:"short", label:"Short Break",   color:"#38bdf8", max:30 },
              { key:"long",  label:"Long Break",    color:"#a78bfa", max:60 },
            ].map(item => (
              <div key={item.key} style={{
                marginBottom:"16px", background:"#141414",
                border:"1px solid #1e1e1e", borderRadius:"12px", padding:"14px 16px",
              }}>
                <div style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", marginBottom:"10px" }}>
                  <span style={{ fontSize:"13px", fontWeight:700, color:item.color }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize:"10px", color:"#2a2a2a" }}>max {item.max} min</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <input type="range" min={1} max={item.max} value={editVals[item.key]}
                    onChange={e=>clampEdit(item.key, e.target.value)}
                    style={{ flex:1, accentColor:item.color, cursor:"pointer" }}/>
                  <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                    <button onClick={()=>clampEdit(item.key, editVals[item.key]-1)}
                      style={{ width:26, height:26, borderRadius:"6px",
                        background:"#1e1e1e", border:"1px solid #2a2a2a",
                        color:"#888", cursor:"pointer", fontSize:"14px",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <input type="number" min={1} max={item.max} value={editVals[item.key]}
                      onChange={e=>clampEdit(item.key, e.target.value)}
                      style={{ width:44, padding:"4px 6px", textAlign:"center",
                        background:"#1e1e1e", border:"1px solid #2a2a2a",
                        borderRadius:"6px", color:item.color, fontSize:"14px",
                        fontWeight:700, fontFamily:"inherit", outline:"none" }}/>
                    <button onClick={()=>clampEdit(item.key, editVals[item.key]+1)}
                      style={{ width:26, height:26, borderRadius:"6px",
                        background:"#1e1e1e", border:"1px solid #2a2a2a",
                        color:"#888", cursor:"pointer", fontSize:"14px",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  </div>
                  <span style={{ fontSize:"11px", color:"#333", fontWeight:600 }}>min</span>
                </div>
              </div>
            ))}

            <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
              <button onClick={saveSettings} style={{
                flex:1, padding:"11px", background:"#fff", color:"#000",
                border:"none", borderRadius:"10px", cursor:"pointer",
                fontWeight:800, fontSize:"13px", fontFamily:"inherit",
              }}>Save & Reset</button>
              <button onClick={()=>setShowEdit(false)} style={{
                padding:"11px 16px", background:"transparent",
                border:"1px solid #1e1e1e", color:"#555",
                borderRadius:"10px", cursor:"pointer",
                fontSize:"13px", fontFamily:"inherit",
              }}>Cancel</button>
              <button onClick={()=>setEditVals({ focus:25, short:5, long:15 })} style={{
                padding:"11px 14px", background:"transparent",
                border:"1px solid #1e1e1e", color:"#333",
                borderRadius:"10px", cursor:"pointer",
                fontSize:"11px", fontFamily:"inherit", fontWeight:600,
              }}>Defaults</button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ width:"100%", maxWidth:"900px", margin:"0 auto",
        padding:"24px 24px 80px", boxSizing:"border-box" }}>

        {/* Mode tabs */}
        <div className="fade-in" style={{ display:"flex", gap:"8px",
          justifyContent:"center", marginBottom:"32px", flexWrap:"wrap" }}>
          {modes.map((m,i) => (
            <button key={m.key} className="mode-btn" onClick={()=>switchMode(i)} style={{
              padding:"8px 18px", borderRadius:"20px", cursor:"pointer",
              fontSize:"12px", fontWeight:700, fontFamily:"inherit",
              background: modeIdx===i ? m.color+"22" : "transparent",
              color:       modeIdx===i ? m.color : "#333",
              border:`1px solid ${modeIdx===i ? m.color+"55" : "#1a1a1a"}`,
              transition:"all 0.2s",
            }}>
              {m.label}
              <span style={{ fontSize:"10px", marginLeft:"6px",
                color: modeIdx===i ? m.color+"aa" : "#222" }}>{m.minutes}m</span>
            </button>
          ))}
        </div>

        {/* Ring */}
        <div className="fade-in" style={{ display:"flex", flexDirection:"column",
          alignItems:"center", marginBottom:"32px" }}>
          <div style={{ position:"relative", width:ringSize, height:ringSize,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ring pct={pct} size={ringSize} stroke={10} color={mode.color}/>
            <div style={{ position:"absolute", inset:0, display:"flex",
              flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px" }}>
              <span style={{ fontSize:"clamp(42px,12vw,72px)", fontWeight:800,
                letterSpacing:"-3px", color:mode.color, fontVariantNumeric:"tabular-nums" }}>
                {fmt(seconds)}
              </span>
              <span style={{ fontSize:"12px", color:"#333", fontWeight:600,
                textTransform:"uppercase", letterSpacing:"2px" }}>{mode.label}</span>
              {running && (
                <span style={{ fontSize:"10px", color:"#222", marginTop:"2px" }}>
                  {Math.ceil(seconds/60)} min left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
          gap:"12px", marginBottom:"36px" }}>
          <button className="ctrl-btn" onClick={reset} style={{
            width:44, height:44, borderRadius:"12px", background:"#0f0f0f",
            border:"1px solid #1e1e1e", color:"#444", cursor:"pointer",
            fontSize:"16px", display:"flex", alignItems:"center",
            justifyContent:"center", transition:"all 0.15s" }}>↺</button>

          <button className="ctrl-btn" onClick={()=>setRunning(r=>!r)} style={{
            width:70, height:70, borderRadius:"50%",
            background: running ? "#1a1a1a" : mode.color,
            border:`2px solid ${running ? "#2a2a2a" : mode.color}`,
            color: running ? mode.color : "#000",
            cursor:"pointer", fontSize:"22px", fontWeight:800,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.2s", fontFamily:"inherit",
            boxShadow: running ? "none" : `0 0 24px ${mode.color}44` }}>
            {running ? "⏸" : "▶"}
          </button>

          <button className="ctrl-btn" onClick={skipToNext} style={{
            width:44, height:44, borderRadius:"12px", background:"#0f0f0f",
            border:"1px solid #1e1e1e", color:"#444", cursor:"pointer",
            fontSize:"16px", display:"flex", alignItems:"center",
            justifyContent:"center", transition:"all 0.15s" }}>⏭</button>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          gap:"10px", marginBottom:"20px" }}>
          {[
            { label:"Sessions",    val:sessions,                      color:"#4ade80" },
            { label:"Full Cycles", val:cycles,                        color:"#a78bfa" },
            { label:"Focus Time",  val:`${sessions*modes[0].minutes}m`, color:"#38bdf8" },
          ].map(stat => (
            <div key={stat.label} style={{ background:"#0d0d0d", border:"1px solid #161616",
              borderRadius:"14px", padding:"16px", textAlign:"center" }}>
              <p style={{ fontSize:"clamp(20px,5vw,28px)", fontWeight:800,
                color:stat.color, letterSpacing:"-1px", marginBottom:"4px" }}>{stat.val}</p>
              <p style={{ fontSize:"10px", color:"#2a2a2a", fontWeight:600,
                textTransform:"uppercase", letterSpacing:"1px" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Timer info card */}
        <div style={{ background:"#0d0d0d", border:"1px solid #161616",
          borderRadius:"14px", padding:"16px", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center",
            justifyContent:"space-between", marginBottom:"12px" }}>
            <p style={{ fontSize:"11px", color:"#2a2a2a", fontWeight:700,
              textTransform:"uppercase", letterSpacing:"1.5px" }}>Timer Setup</p>
            <button onClick={openEdit} style={{
              background:"transparent", border:"1px solid #1e1e1e",
              color:"#333", fontSize:"10px", fontWeight:600,
              padding:"3px 10px", borderRadius:"6px", cursor:"pointer",
              fontFamily:"inherit" }}>Edit ✎</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
            {modes.map(m => (
              <div key={m.key} style={{ textAlign:"center" }}>
                <p style={{ fontSize:"22px", fontWeight:800,
                  color:m.color, letterSpacing:"-0.5px" }}>{m.minutes}m</p>
                <p style={{ fontSize:"10px", color:"#2a2a2a",
                  fontWeight:500, marginTop:"2px" }}>{m.label}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:"10px", color:"#1e1e1e", marginTop:"12px", textAlign:"center" }}>
            Long break after every 4 focus sessions
          </p>
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background:"#0d0d0d", border:"1px solid #161616",
            borderRadius:"14px", padding:"16px" }}>
            <p style={{ fontSize:"11px", color:"#2a2a2a", fontWeight:700,
              textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:"12px" }}>
              Session Log
            </p>
            {log.map((entry, i) => (
              <div key={i} className="log-item" style={{
                animationDelay:`${i*0.04}s`, padding:"7px 0",
                borderBottom: i<log.length-1 ? "1px solid #111":"none",
                fontSize:"12px", color:"#333", fontWeight:500,
              }}>{entry}</div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}