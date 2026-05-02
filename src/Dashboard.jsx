import { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

const [target, setTarget] = useState(75);
const [showTargetModal, setShowTargetModal] = useState(false);
const [targetInput, setTargetInput] = useState("75");
const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function dateKey(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function getFirstDay(y,m){return new Date(y,m,1).getDay();}

function Ring({pct,size,stroke,color,bg="#1c1c1c"}){
  const r=(size-stroke*2)/2, c=2*Math.PI*r, off=c-(Math.min(pct,100)/100)*c;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)"}}/>
    </svg>
  );
}

export default function Dashboard({user, onNavigate}){
  const uid     = user.uid;
  const today   = new Date();
  const todayKey= dateKey(today.getFullYear(),today.getMonth(),today.getDate());

  const subjCol = collection(db,"users",uid,"subjects");
  const calCol  = collection(db,"users",uid,"calendar");

  const [subjects, setSubjects] = useState([]);
  const [calData,  setCalData]  = useState({});
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay,   setSelDay]   = useState(null);
  const [newName,  setNewName]  = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [calIn,    setCalIn]    = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exams,    setExams]    = useState(() => {
    try {
      const saved = localStorage.getItem(`ktu_exams_${uid}`);
      return saved ? JSON.parse(saved) : [
        {id:1, label:"Series 1", date:""},
        {id:2, label:"Series 2", date:""},
        {id:3, label:"Lab Exam", date:""},
      ];
    } catch { return [{id:1,label:"Series 1",date:""},{id:2,label:"Series 2",date:""},{id:3,label:"Lab Exam",date:""}]; }
  });
  const [showExamEdit, setShowExamEdit] = useState(false);
  const [examDrafts,   setExamDrafts]   = useState([]);

  useEffect(()=>{const t=setTimeout(()=>setCalIn(true),100);return()=>clearTimeout(t);},[]);
  useEffect(()=>onSnapshot(subjCol,snap=>setSubjects(snap.docs.map(d=>({id:d.id,...d.data()})))),[uid]);
  useEffect(()=>onSnapshot(calCol,snap=>{const obj={};snap.docs.forEach(d=>{obj[d.id]=d.data();});setCalData(obj);}),[uid]);
  useEffect(() => {
  const settingsDoc = doc(db, "users", uid, "settings", "preferences");
  onSnapshot(settingsDoc, (snap) => {if (snap.exists()) {setTarget(snap.data().attendanceTarget ?? 75);} else {setShowTargetModal(true);}});}, [uid]);

  const attendance = useCallback(()=>{
    const map={};
    subjects.forEach(s=>{map[s.id]={present:0,total:0};});
    Object.values(calData).forEach(dayObj=>{
      Object.entries(dayObj).forEach(([sid,status])=>{
        if(!map[sid])return;
        if(status==="P"){map[sid].present++;map[sid].total++;}
        if(status==="A"){map[sid].total++;}
      });
    });
    return map;
  },[subjects,calData])();

  function pctFor(sid){
    const{present,total}=attendance[sid]||{present:0,total:0};
    return total===0?0:Math.round((present/total)*100);
  }
  function canSkip(sid){
    const{present,total}=attendance[sid]||{present:0,total:0};
    let s=0;while(Math.round((present/(total+s+1))*100)>=TARGET)s++;return s;
  }
  function needMore(sid){
    const{present,total}=attendance[sid]||{present:0,total:0};
    if(pctFor(sid)>=TARGET)return 0;
    let e=0;while(Math.round(((present+e)/(total+e))*100)<TARGET)e++;return e;
  }

  const overallPct=subjects.length
    ?Math.round(subjects.reduce((a,s)=>a+pctFor(s.id),0)/subjects.length):0;
  const safe=overallPct>=TARGET;

  async function markDay(dk,sid,status){
    await setDoc(doc(db,"users",uid,"calendar",dk),{...(calData[dk]||{}),[sid]:status},{merge:true});
  }
  async function addSubject(){
    if(!newName.trim())return;
    await setDoc(doc(subjCol),{name:newName.trim()});
    setNewName("");setShowAdd(false);
  }
  async function deleteSubject(sid){
    await deleteDoc(doc(db,"users",uid,"subjects",sid));
  }
  function saveExams(drafts){
    setExams(drafts);
    localStorage.setItem(`ktu_exams_${uid}`,JSON.stringify(drafts));
    setShowExamEdit(false);
  }

  function dayCompletion(dk){
    const d=calData[dk];if(!d)return null;
    const active=Object.entries(d).filter(([,v])=>v==="P"||v==="A");
    if(!active.length)return null;
    return Math.round(active.filter(([,v])=>v==="P").length/active.length*100);
  }
  function ringColor(comp){
    if(comp===null)return null;if(comp===100)return "#4ade80";
    if(comp>=60)return "#facc15";return "#f87171";
  }

  const selKey     =selDay?dateKey(calYear,calMonth,selDay):null;
  const daysInMonth=getDaysInMonth(calYear,calMonth);
  const firstDay   =getFirstDay(calYear,calMonth);
  const markBtns=[
    {val:"P",label:"✓ Present", bg:"#0c1a0c",border:"#1d3320",color:"#4ade80"},
    {val:"A",label:"✗ Absent",  bg:"#1a0c0c",border:"#3a1414",color:"#f87171"},
    {val:"N",label:"— No class",bg:"#141414", border:"#222",   color:"#555"},
  ];

  // Exam countdown logic
  const now=new Date();now.setHours(0,0,0,0);
  const upcoming=exams.filter(e=>e.date).map(e=>{
    const d=new Date(e.date+"T00:00:00");
    return{...e,diff:Math.ceil((d-now)/86400000)};
  }).filter(e=>e.diff>=0).sort((a,b)=>a.diff-b.diff);
  const nextExam=upcoming[0];
  const danger=overallPct<75&&nextExam&&nextExam.diff<=14;

  return(
    <div style={{minHeight:"100vh",background:"#070707",
      fontFamily:"'Outfit',sans-serif",color:"#fff",width:"100%",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{width:100%;background:#070707;overflow-x:hidden;}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes calEnter{0%{opacity:0;transform:translateY(-24px) scale(0.96)}65%{opacity:1;transform:translateY(4px) scale(1.005)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dayPop{from{opacity:0;transform:scale(0.3) rotate(-12deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
        @keyframes cardSlide{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes panelSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        @keyframes drawerSlide{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
        .card{animation:cardSlide 0.35s cubic-bezier(.22,1,.36,1) both;}
        .cal-wrap{animation:calEnter 0.5s cubic-bezier(.22,1,.36,1) both;}
        .day-cell{animation:dayPop 0.25s cubic-bezier(.34,1.56,.64,1) both;}
        .panel-in{animation:panelSlide 0.25s cubic-bezier(.22,1,.36,1) both;}
        .overall{animation:slideUp 0.35s ease both;}
        .del-btn:hover{color:#f87171 !important;}
        .nav-btn:hover{background:#1e1e1e !important;}
        .mark-btn{transition:all 0.15s ease;cursor:pointer;}
        .mark-btn:hover{filter:brightness(1.3);}
        .add-area:hover{border-color:#2a2a2a !important;color:#555 !important;}
        .menu-item:hover{background:#1a1a1a !important;}
        @media(max-width:520px){
          .hide-mobile{display:none !important;}
          .mark-label{display:none !important;}
          .mark-icon{display:inline !important;}
        }
        @media(min-width:521px){.mark-icon{display:none !important;}}
      `}</style>

      {/* Topbar */}
      <header style={{width:"100%",display:"flex",alignItems:"center",
  justifyContent:"space-between",padding:"13px 16px",
  borderBottom:"1px solid #111",background:"#0a0a0a",
  position:"sticky",top:0,zIndex:30}}>

  {/* Left — hamburger + logo */}
  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
    <button onClick={()=>setMenuOpen(o=>!o)} style={{
      background:"transparent",border:"1px solid #1a1a1a",
      borderRadius:"6px",cursor:"pointer",
      display:"flex",flexDirection:"column",gap:"3px",
      alignItems:"center",justifyContent:"center",width:34,height:32,padding:0}}>
      <span style={{display:"block",width:14,height:1.5,background:"#444",borderRadius:2,
        transition:"all 0.3s",
        transform:menuOpen?"rotate(45deg) translate(3px,3px)":"none"}}/>
      <span style={{display:"block",width:14,height:1.5,background:"#444",borderRadius:2,
        transition:"all 0.3s",opacity:menuOpen?0:1}}/>
      <span style={{display:"block",width:14,height:1.5,background:"#444",borderRadius:2,
        transition:"all 0.3s",
        transform:menuOpen?"rotate(-45deg) translate(3px,-3px)":"none"}}/>
    </button>
    <span style={{fontSize:"16px",fontWeight:800,letterSpacing:"-0.8px"}}>
      CollaDO<span style={{color:"#282828",fontWeight:500}}>.track</span>
    </span>
  </div>

  {/* Right — email + sign out */}
  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
    <span className="hide-mobile" style={{color:"#282828",fontSize:"12px",
      maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      {user.email}
    </span>
    <button onClick={()=>signOut(auth)} style={{
      background:"transparent",border:"1px solid #1a1a1a",color:"#444",
      padding:"5px 12px",borderRadius:"6px",cursor:"pointer",
      fontSize:"12px",fontWeight:600,fontFamily:"inherit"}}>Sign out</button>
  </div>

  {/* Left slide drawer */}
  {menuOpen&&(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}
      onClick={()=>setMenuOpen(false)}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",
        animation:"overlayIn 0.25s ease both"}}/>
      <div style={{position:"relative",width:"260px",height:"100%",
        background:"#0d0d0d",borderRight:"1px solid #1a1a1a",
        display:"flex",flexDirection:"column",
        animation:"drawerSlide 0.3s cubic-bezier(.22,1,.36,1) both",
        zIndex:201}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #111"}}>
          <p style={{fontSize:"18px",fontWeight:800,letterSpacing:"-0.8px",color:"#fff"}}>
            CollaDO
          </p>
          <p style={{fontSize:"11px",color:"#333",marginTop:"4px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {user.email}
          </p>
        </div>
        <div style={{flex:1,padding:"12px 10px"}}>
          {[
            {label:"Dashboard", page:"dashboard"},
            {label:"Tasks",     page:"reminders"},
            {label:"Pomodoro",  page:"pomodoro"},
          ].map(item=>(
            <button key={item.page} onClick={()=>{setMenuOpen(false);onNavigate(item.page);}}
              style={{width:"100%",padding:"12px 14px",background:"transparent",
                border:"none",borderRadius:"10px",color:"#666",
                fontSize:"14px",fontWeight:600,fontFamily:"inherit",
                cursor:"pointer",textAlign:"left",display:"flex",
                alignItems:"center",gap:"12px",marginBottom:"4px",
                transition:"background 0.15s, color 0.15s"}}
              onMouseOver={e=>{e.currentTarget.style.background="#1a1a1a";e.currentTarget.style.color="#fff";}}
              onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#666";}}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{padding:"16px",borderTop:"1px solid #111"}}>
          <button onClick={()=>signOut(auth)} style={{
            width:"100%",padding:"11px",background:"transparent",
            border:"1px solid #1e1e1e",color:"#444",borderRadius:"10px",
            cursor:"pointer",fontSize:"13px",fontWeight:600,fontFamily:"inherit",
            transition:"border-color 0.15s,color 0.15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#f87171";e.currentTarget.style.color="#f87171";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#1e1e1e";e.currentTarget.style.color="#444";}}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )}

</header>

      <main style={{width:"100%",maxWidth:"900px",margin:"0 auto",
        padding:"16px clamp(16px,4vw,48px) 80px",boxSizing:"border-box"}}>

        {/* ── EXAM COUNTDOWN ── */}
        <div style={{marginBottom:"12px"}}>
          {nextExam?(
            <div style={{background:danger?"#1a0c0c":"#0d0d0d",
              border:`1px solid ${danger?"#3a1414":"#1a1a1a"}`,
              borderRadius:"14px",padding:"14px 16px",
              display:"flex",alignItems:"center",
              justifyContent:"space-between",flexWrap:"wrap",gap:"10px",
              animation:"slideUp 0.35s ease both"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{width:44,height:44,borderRadius:"10px",flexShrink:0,
                  background:danger?"#2a0c0c":"#141414",
                  border:`1px solid ${danger?"#3a1414":"#1e1e1e"}`,
                  display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:"16px",fontWeight:800,lineHeight:1,
                    color:danger?"#f87171":"#fff"}}>{nextExam.diff}</span>
                  <span style={{fontSize:"8px",color:"#333",fontWeight:600,letterSpacing:"0.5px"}}>DAYS</span>
                </div>
                <div>
                  <p style={{fontWeight:700,fontSize:"13px",marginBottom:"3px"}}>
                    {nextExam.label} in {nextExam.diff===0?"today!":nextExam.diff===1?"tomorrow!":`${nextExam.diff} days`}
                  </p>
                  {danger?(
                    <p style={{color:"#f87171",fontSize:"11px",fontWeight:600}}>
                      ⚠ {overallPct}% attendance — risk of exam block!
                    </p>
                  ):overallPct<75?(
                    <p style={{color:"#facc15",fontSize:"11px"}}>
                      Attendance low — focus this week to avoid block
                    </p>
                  ):(
                    <p style={{color:"#2a2a2a",fontSize:"11px"}}>
                      {overallPct}% attendance — you're on track ✓
                    </p>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
                {upcoming.map(e=>(
                  <div key={e.id} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",
                    borderRadius:"8px",padding:"5px 10px",textAlign:"center"}}>
                    <p style={{fontSize:"9px",color:"#333",fontWeight:600,
                      textTransform:"uppercase",letterSpacing:"0.5px"}}>{e.label}</p>
                    <p style={{fontSize:"12px",fontWeight:800,
                      color:e.diff<=7?"#f87171":e.diff<=14?"#facc15":"#4ade80"}}>
                      {e.diff===0?"Today":`${e.diff}d`}
                    </p>
                  </div>
                ))}
                <button onClick={()=>{setExamDrafts(JSON.parse(JSON.stringify(exams)));setShowExamEdit(true);}}
                  style={{background:"transparent",border:"1px dashed #1a1a1a",
                    borderRadius:"8px",padding:"5px 10px",color:"#2a2a2a",
                    cursor:"pointer",fontSize:"11px",fontFamily:"inherit",fontWeight:600}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor="#333";e.currentTarget.style.color="#555";}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#2a2a2a";}}>
                  ✎ Edit
                </button>
              </div>
            </div>
          ):(
            <button onClick={()=>{setExamDrafts(JSON.parse(JSON.stringify(exams)));setShowExamEdit(true);}}
              style={{width:"100%",padding:"12px 16px",background:"#0d0d0d",
                border:"1px dashed #1a1a1a",borderRadius:"14px",cursor:"pointer",
                color:"#252525",fontSize:"13px",fontFamily:"inherit",
                fontWeight:600,textAlign:"left",transition:"all 0.2s"}}
              onMouseOver={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#555";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#252525";}}>
              Set Series Exam dates →
            </button>
          )}

          {/* Exam modal */}
          {showExamEdit&&(
            <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,
              display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",
              animation:"overlayIn 0.2s ease both"}}
              onClick={()=>setShowExamEdit(false)}>
              <div style={{background:"#0f0f0f",border:"1px solid #1e1e1e",
                borderRadius:"20px",padding:"24px",width:"100%",maxWidth:"360px",
                animation:"panelSlide 0.25s cubic-bezier(.22,1,.36,1) both"}}
                onClick={e=>e.stopPropagation()}>
                <p style={{fontWeight:800,fontSize:"15px",marginBottom:"4px"}}>Exam Dates</p>
                <p style={{color:"#2a2a2a",fontSize:"11px",marginBottom:"18px"}}>
                  Set your series exam dates
                </p>
                {examDrafts.map((exam,i)=>(
                  <div key={exam.id} style={{marginBottom:"12px"}}>
                    <label style={{fontSize:"11px",color:"#333",fontWeight:700,
                      textTransform:"uppercase",letterSpacing:"1px",
                      display:"block",marginBottom:"6px"}}>{exam.label}</label>
                    <input type="date" value={exam.date}
                      onChange={e=>{const d=[...examDrafts];d[i]={...d[i],date:e.target.value};setExamDrafts(d);}}
                      style={{width:"100%",padding:"9px 12px",background:"#141414",
                        border:"1px solid #1e1e1e",borderRadius:"8px",color:"#fff",
                        fontSize:"13px",outline:"none",fontFamily:"inherit",colorScheme:"dark"}}/>
                  </div>
                ))}
                <div style={{display:"flex",gap:"8px",marginTop:"16px"}}>
                  <button onClick={()=>saveExams(examDrafts)} style={{
                    flex:1,padding:"11px",background:"#fff",color:"#000",
                    border:"none",borderRadius:"10px",cursor:"pointer",
                    fontWeight:800,fontSize:"13px",fontFamily:"inherit"}}>Save</button>
                  <button onClick={()=>setShowExamEdit(false)} style={{
                    padding:"11px 16px",background:"transparent",
                    border:"1px solid #1e1e1e",color:"#555",
                    borderRadius:"10px",cursor:"pointer",
                    fontSize:"13px",fontFamily:"inherit"}}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── OVERALL ── */}
        <div className="overall" style={{background:"#0d0d0d",
          border:`1px solid ${safe?"#1a3320":"#2d1212"}`,
          borderRadius:"16px",padding:"20px",marginBottom:"12px",
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
          <div>
            <p style={{color:"#282828",fontSize:"10px",letterSpacing:"2px",
              textTransform:"uppercase",marginBottom:"6px",fontWeight:600}}>Overall</p>
            <div style={{fontSize:"clamp(36px,9vw,52px)",fontWeight:800,
              lineHeight:1,letterSpacing:"-2px",color:safe?"#4ade80":"#f87171"}}>
              {overallPct}
              <span style={{fontSize:"clamp(14px,4vw,20px)",letterSpacing:0,fontWeight:600}}>%</span>
            </div>
            <p style={{color:"#282828",fontSize:"11px",marginTop:"6px",fontWeight:500}}>
              {safe?"✓ above 75% — you're good":"⚠ below 75% — attend more"}
            </p>
          </div>
          <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
            <Ring pct={overallPct} size={72} stroke={5} color={safe?"#4ade80":"#f87171"}/>
            <div style={{position:"absolute",inset:0,display:"flex",
              alignItems:"center",justifyContent:"center",
              fontSize:"12px",fontWeight:700,color:safe?"#4ade80":"#f87171"}}>
              {overallPct}%
            </div>
          </div>
        </div>

        {/* ── BUNK PLANNER ── */}
        {subjects.length>0&&(
          <div className="overall" style={{background:"#0d0d0d",
            border:"1px solid #1a1a1a",borderRadius:"16px",
            padding:"18px 20px",marginBottom:"12px",animationDelay:"0.08s"}}>
            <p style={{color:"#282828",fontSize:"10px",letterSpacing:"2px",
              textTransform:"uppercase",marginBottom:"14px",fontWeight:600}}>
              🛏 Bunk Planner
            </p>
            {subjects.map((s,i)=>{
              const{present,total}=attendance[s.id]||{present:0,total:0};
              const p=pctFor(s.id);
              let skipCount=0;
              while(Math.round((present/(total+skipCount+1))*100)>=TARGET)skipCount++;
              let needCount=0;
              if(p<TARGET){while(Math.round(((present+needCount)/(total+needCount))*100)<TARGET)needCount++;}
              const isSafe=p>=TARGET;
              const atLimit=isSafe&&skipCount===0;
              return(
                <div key={s.id} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",padding:"10px 0",
                  borderBottom:i<subjects.length-1?"1px solid #0f0f0f":"none",
                  gap:"12px",flexWrap:"wrap"}}>
                  <div style={{minWidth:0,flex:1}}>
                    <p style={{fontWeight:700,fontSize:"13px",marginBottom:"3px",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</p>
                    <p style={{color:"#2a2a2a",fontSize:"10px"}}>{present}/{total} attended</p>
                  </div>
                  <div style={{flexShrink:0,textAlign:"right"}}>
                    {isSafe&&skipCount>0&&(
                      <div style={{background:"#0c1a0c",border:"1px solid #1d3320",
                        borderRadius:"8px",padding:"6px 12px"}}>
                        <p style={{color:"#4ade80",fontSize:"12px",fontWeight:700}}>
                          Skip up to {skipCount} class{skipCount>1?"es":""}
                        </p>
                        <p style={{color:"#1d3320",fontSize:"10px",marginTop:"1px"}}>still safe above 75%</p>
                      </div>
                    )}
                    {atLimit&&(
                      <div style={{background:"#1a1200",border:"1px solid #3a2e00",
                        borderRadius:"8px",padding:"6px 12px"}}>
                        <p style={{color:"#facc15",fontSize:"12px",fontWeight:700}}>⚠ Don't skip any</p>
                        <p style={{color:"#3a2e00",fontSize:"10px",marginTop:"1px"}}>exactly at 75% limit</p>
                      </div>
                    )}
                    {!isSafe&&(
                      <div style={{background:"#1a0c0c",border:"1px solid #3a1414",
                        borderRadius:"8px",padding:"6px 12px"}}>
                        <p style={{color:"#f87171",fontSize:"12px",fontWeight:700}}>
                          Attend {needCount} more
                        </p>
                        <p style={{color:"#3a1414",fontSize:"10px",marginTop:"1px"}}>to reach 75%</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:"14px",paddingTop:"12px",borderTop:"1px solid #111",
              display:"flex",alignItems:"center",justifyContent:"space-between",
              flexWrap:"wrap",gap:"8px"}}>
              <p style={{color:"#252525",fontSize:"11px",fontWeight:500}}>
                Total skippable across all subjects
              </p>
              <p style={{fontWeight:800,fontSize:"16px",letterSpacing:"-0.5px",
                color:subjects.every(s=>pctFor(s.id)>=TARGET)?"#4ade80":"#f87171"}}>
                {subjects.reduce((acc,s)=>{
                  const{present,total}=attendance[s.id]||{present:0,total:0};
                  let skip=0;
                  while(Math.round((present/(total+skip+1))*100)>=TARGET)skip++;
                  return acc+skip;
                },0)} classes
              </p>
            </div>
          </div>
        )}

        {/* ── SUBJECT CARDS ── */}
        {subjects.map((s,i)=>{
          const p=pctFor(s.id);
          const isSafe=p>=TARGET;
          const{present,total}=attendance[s.id]||{present:0,total:0};
          const cur=(calData[todayKey]||{})[s.id]||"N";
          return(
            <div key={s.id} className="card" style={{animationDelay:`${i*0.06}s`,
              background:"#0d0d0d",border:"1px solid #161616",
              borderRadius:"14px",marginBottom:"10px",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",padding:"14px 14px 0",gap:"10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"11px",flex:1,minWidth:0}}>
                  <div style={{position:"relative",width:42,height:42,flexShrink:0}}>
                    <Ring pct={p} size={42} stroke={3} color={isSafe?"#4ade80":"#f87171"}/>
                    <div style={{position:"absolute",inset:0,display:"flex",
                      alignItems:"center",justifyContent:"center",
                      fontSize:"8px",fontWeight:700,
                      color:isSafe?"#4ade80":"#f87171"}}>{p}%</div>
                  </div>
                  <div style={{minWidth:0}}>
                    <p style={{fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",
                      marginBottom:"3px",overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</p>
                    <p style={{color:"#2a2a2a",fontSize:"11px",fontWeight:400}}>
                      {present}/{total} &nbsp;·&nbsp; {isSafe
                        ?canSkip(s.id)>0?`can skip ${canSkip(s.id)}`:"at limit"
                        :`need ${needMore(s.id)} more`}
                    </p>
                  </div>
                </div>
                <button className="del-btn" onClick={()=>deleteSubject(s.id)} style={{
                  background:"transparent",border:"none",color:"#222",
                  cursor:"pointer",fontSize:"13px",padding:"4px 6px",
                  flexShrink:0,transition:"color 0.15s",alignSelf:"flex-start"}}>✕</button>
              </div>
              <div style={{margin:"11px 14px 0",height:"2px",
                background:"#141414",borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",width:`${p}%`,
                  background:isSafe?"#4ade80":"#f87171",
                  transition:"width 0.5s ease",borderRadius:"2px"}}/>
              </div>
              <div style={{height:"1px",background:"#111",margin:"11px 0 0"}}/>
              <div style={{padding:"10px 14px 12px",display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontSize:"9px",color:"#222",fontWeight:700,
                  letterSpacing:"1.5px",textTransform:"uppercase",
                  flexShrink:0,marginRight:"2px"}}>Today</span>
                {markBtns.map(btn=>(
                  <button key={btn.val} className="mark-btn"
                    onClick={()=>markDay(todayKey,s.id,btn.val)}
                    style={{flex:1,padding:"8px 4px",borderRadius:"8px",
                      fontSize:"11px",fontWeight:600,
                      border:`1px solid ${cur===btn.val?btn.border:"#161616"}`,
                      background:cur===btn.val?btn.bg:"#0a0a0a",
                      color:cur===btn.val?btn.color:"#252525",
                      fontFamily:"inherit",whiteSpace:"nowrap",textAlign:"center"}}>
                    <span className="mark-label">{btn.label}</span>
                    <span className="mark-icon">{btn.val==="P"?"✓":btn.val==="A"?"✗":"—"}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── ADD SUBJECT ── */}
        <div style={{marginBottom:"12px"}}>
          {showAdd?(
            <div className="panel-in" style={{background:"#0d0d0d",
              border:"1px solid #161616",borderRadius:"14px",padding:"14px"}}>
              <input autoFocus value={newName}
                onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addSubject()}
                placeholder="e.g. Engineering Maths"
                style={{width:"100%",padding:"10px 12px",background:"#070707",
                  border:"1px solid #1c1c1c",borderRadius:"8px",color:"#fff",
                  fontSize:"14px",marginBottom:"10px",outline:"none",
                  fontFamily:"inherit",fontWeight:500}}/>
              <div style={{display:"flex",gap:"7px"}}>
                <button onClick={addSubject} style={{flex:1,padding:"10px",
                  background:"#fff",color:"#000",border:"none",borderRadius:"8px",
                  cursor:"pointer",fontWeight:700,fontSize:"13px",fontFamily:"inherit"}}>
                  Add Subject
                </button>
                <button onClick={()=>{setShowAdd(false);setNewName("");}} style={{
                  padding:"10px 14px",background:"transparent",
                  border:"1px solid #1c1c1c",color:"#444",borderRadius:"8px",
                  cursor:"pointer",fontSize:"13px",fontFamily:"inherit"}}>Cancel</button>
              </div>
            </div>
          ):(
            <button className="add-area" onClick={()=>setShowAdd(true)} style={{
              width:"100%",padding:"12px",background:"transparent",
              border:"1px dashed #1a1a1a",color:"#252525",
              borderRadius:"14px",cursor:"pointer",fontSize:"13px",
              fontFamily:"inherit",fontWeight:600,transition:"all 0.2s"}}>
              + Add Subject
            </button>
          )}
        </div>

        {/* ══ CALENDAR ══ */}
        <div className={calIn?"cal-wrap":""} style={{marginTop:"16px",background:"#0d0d0d",
          border:"1px solid #161616",borderRadius:"18px",padding:"18px 14px",
          opacity:calIn?1:0}}>
          <div style={{display:"flex",alignItems:"center",
            justifyContent:"space-between",marginBottom:"14px"}}>
            <button className="nav-btn" onClick={()=>{
              setSelDay(null);
              if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}
              else setCalMonth(m=>m-1);
            }} style={{background:"#141414",border:"1px solid #1c1c1c",
              color:"#555",width:30,height:30,borderRadius:"7px",
              cursor:"pointer",fontSize:"15px",display:"flex",
              alignItems:"center",justifyContent:"center",
              flexShrink:0,transition:"background 0.15s"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <p style={{fontWeight:700,fontSize:"14px",letterSpacing:"-0.2px"}}>
                {MONTHS[calMonth]} {calYear}
              </p>
              <p style={{color:"#222",fontSize:"9px",marginTop:"2px"}}>
                tap a day to mark attendance
              </p>
            </div>
            <button className="nav-btn" onClick={()=>{
              setSelDay(null);
              if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}
              else setCalMonth(m=>m+1);
            }} style={{background:"#141414",border:"1px solid #1c1c1c",
              color:"#555",width:30,height:30,borderRadius:"7px",
              cursor:"pointer",fontSize:"15px",display:"flex",
              alignItems:"center",justifyContent:"center",
              flexShrink:0,transition:"background 0.15s"}}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:"4px"}}>
            {DAYS_SHORT.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:"9px",
                color:"#222",padding:"2px 0",fontWeight:600,letterSpacing:"0.3px"}}>{d}</div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1;
              const dk=dateKey(calYear,calMonth,day);
              const comp=dayCompletion(dk);
              const rc=ringColor(comp);
              const isToday=dk===todayKey;
              const isSel=selDay===day;
              return(
                <div key={day} className="day-cell"
                  style={{animationDelay:`${i*0.012}s`,display:"flex",
                    alignItems:"center",justifyContent:"center",
                    padding:"2px",cursor:"pointer"}}
                  onClick={()=>setSelDay(isSel?null:day)}>
                  <div style={{position:"relative",width:"min(38px,13vw)",
                    height:"min(38px,13vw)",display:"flex",
                    alignItems:"center",justifyContent:"center"}}>
                    {rc&&(
                      <div style={{position:"absolute",inset:0,display:"flex",
                        alignItems:"center",justifyContent:"center"}}>
                        <Ring pct={comp} size={34} stroke={2.5} color={rc} bg="#161616"/>
                      </div>
                    )}
                    <div style={{width:22,height:22,borderRadius:"50%",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      background:isSel?"#fff":isToday?"#1e1e1e":"transparent",
                      border:isToday&&!isSel?"1px solid #2a2a2a":"none",
                      fontSize:"clamp(9px,2.5vw,11px)",
                      fontWeight:isToday||isSel?700:400,
                      color:isSel?"#000":isToday?"#fff":"#444",
                      zIndex:1,transition:"all 0.15s"}}>{day}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:"12px",marginTop:"12px",justifyContent:"center"}}>
            {[["#4ade80","Full"],["#facc15","Partial"],["#f87171","Low"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:c}}/>
                <span style={{fontSize:"10px",color:"#333",fontWeight:500}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        {selDay&&selKey&&(
          <div className="panel-in" style={{marginTop:"10px",background:"#0d0d0d",
            border:"1px solid #1a1a1a",borderRadius:"14px",padding:"14px"}}>
            <p style={{fontWeight:700,fontSize:"13px",marginBottom:"2px"}}>
              {MONTHS[calMonth]} {selDay}, {calYear}
            </p>
            <p style={{color:"#252525",fontSize:"10px",marginBottom:"12px"}}>
              ✓ present · ✗ absent · — no class
            </p>
            {subjects.length===0&&(
              <p style={{color:"#222",fontSize:"12px"}}>No subjects added yet.</p>
            )}
            {subjects.map((s,i)=>{
              const cur=(calData[selKey]||{})[s.id]||"N";
              return(
                <div key={s.id} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",gap:"8px",padding:"9px 0",
                  borderBottom:i<subjects.length-1?"1px solid #111":"none"}}>
                  <span style={{fontSize:"13px",fontWeight:600,flex:1,minWidth:0,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                  <div style={{display:"flex",gap:"5px",flexShrink:0}}>
                    {[
                      {val:"P",label:"✓",bg:"#0c1a0c",border:"#1d3320",color:"#4ade80"},
                      {val:"A",label:"✗",bg:"#1a0c0c",border:"#3a1414",color:"#f87171"},
                      {val:"N",label:"—",bg:"#141414",border:"#222",color:"#555"},
                    ].map(btn=>(
                      <button key={btn.val} className="mark-btn"
                        onClick={()=>markDay(selKey,s.id,btn.val)}
                        style={{width:34,height:34,borderRadius:"7px",
                          fontSize:"13px",fontWeight:700,
                          border:`1px solid ${cur===btn.val?btn.border:"#161616"}`,
                          background:cur===btn.val?btn.bg:"#0a0a0a",
                          color:cur===btn.val?btn.color:"#252525",
                          fontFamily:"inherit"}}>{btn.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}