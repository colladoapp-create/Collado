import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, orderBy, query } from "firebase/firestore";

const TYPES = [
  { val:"assignment", label:"Assignment", color:"#facc15", bg:"#1a1600" },
  { val:"project",    label:"Project",    color:"#a78bfa", bg:"#150f2a" },
  { val:"reminder",   label:"Reminder",   color:"#38bdf8", bg:"#071a26" },
];

function typeInfo(val) { return TYPES.find(t=>t.val===val) || TYPES[2]; }

export default function Reminders({ user, onNavigate }) {
  const uid    = user.uid;
  const colRef = collection(db, "users", uid, "tasks");
  const q      = query(colRef, orderBy("createdAt","desc"));

  const [tasks,    setTasks]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [due,      setDue]      = useState("");
  const [type,     setType]     = useState("assignment");
  const [filter,   setFilter]   = useState("all");

  useEffect(() => onSnapshot(q, snap =>
    setTasks(snap.docs.map(d=>({id:d.id,...d.data()})))
  ), [uid]);

  async function addTask() {
    if (!title.trim()) return;
    await addDoc(colRef, {
      title: title.trim(), desc: desc.trim(),
      due, type, done: false,
      createdAt: serverTimestamp(),
    });
    setTitle(""); setDesc(""); setDue(""); setType("assignment");
    setShowForm(false);
  }
  async function toggleDone(task) {
    await updateDoc(doc(db,"users",uid,"tasks",task.id), { done: !task.done });
  }
  async function deleteTask(id) {
    await deleteDoc(doc(db,"users",uid,"tasks",id));
  }

  function isOverdue(due, done) {
    if (!due || done) return false;
    return new Date(due) < new Date(new Date().toDateString());
  }
  function daysLeft(due) {
    if (!due) return null;
    const diff = Math.ceil((new Date(due) - new Date(new Date().toDateString())) / 86400000);
    if (diff < 0)  return { label:`${Math.abs(diff)}d overdue`, color:"#f87171" };
    if (diff === 0) return { label:"Due today",                  color:"#facc15" };
    if (diff === 1) return { label:"Tomorrow",                   color:"#facc15" };
    return { label:`${diff}d left`, color:"#4ade80" };
  }

  const filtered = tasks.filter(t =>
    filter === "all"  ? true :
    filter === "done" ? t.done :
    filter === "todo" ? !t.done : t.type === filter
  );

  const pending = tasks.filter(t=>!t.done).length;

  return (
    <div style={{ minHeight:"100vh", background:"#070707",
      fontFamily:"'Outfit',sans-serif", color:"#fff",
      width:"100%", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html,body { background:#070707; overflow-x:hidden; }

        @keyframes slideUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes taskIn {
          from { opacity:0; transform:translateX(-10px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .task-card { animation: taskIn 0.3s cubic-bezier(.22,1,.36,1) both; }
        .form-box  { animation: slideUp 0.25s cubic-bezier(.22,1,.36,1) both; }
        .pill:hover { opacity:0.8; }
        .del-btn:hover { color:#f87171 !important; }
        .check-btn:hover { border-color:#444 !important; }
        @media(max-width:520px){ .hide-sm{ display:none !important; } }
      `}</style>

      {/* Topbar */}
      <header style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"13px 16px", borderBottom:"1px solid #111",
        background:"#0a0a0a", position:"sticky", top:0, zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <button onClick={()=>onNavigate("dashboard")} style={{
            background:"transparent", border:"none", color:"#444",
            cursor:"pointer", fontSize:"18px", padding:"2px 6px",
            display:"flex", alignItems:"center",
          }}>←</button>
          <span style={{ fontSize:"16px", fontWeight:800, letterSpacing:"-0.8px" }}>
            KTU<span style={{ color:"#282828", fontWeight:500 }}>.tasks</span>
          </span>
        </div>
        {pending > 0 && (
          <span style={{ background:"#1a1a1a", border:"1px solid #222",
            color:"#facc15", fontSize:"11px", fontWeight:700,
            padding:"3px 10px", borderRadius:"20px" }}>
            {pending} pending
          </span>
        )}
      </header>

      <main style={{ width:"100%", maxWidth:"900px", margin:"0 auto",
        padding:"16px 24px 80px", boxSizing:"border-box" }}>

        {/* Filter pills */}
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
          {[
            {val:"all",        label:"All"},
            {val:"todo",       label:"To do"},
            {val:"assignment", label:"Assignments"},
            {val:"project",    label:"Projects"},
            {val:"reminder",   label:"Reminders"},
            {val:"done",       label:"Done"},
          ].map(f=>(
            <button key={f.val} className="pill" onClick={()=>setFilter(f.val)} style={{
              padding:"5px 12px", borderRadius:"20px", cursor:"pointer",
              fontSize:"11px", fontWeight:600, fontFamily:"inherit",
              background: filter===f.val ? "#fff" : "#0f0f0f",
              color:       filter===f.val ? "#000" : "#333",
              border: `1px solid ${filter===f.val?"#fff":"#1a1a1a"}`,
              transition:"all 0.15s",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Add form */}
        {showForm ? (
          <div className="form-box" style={{
            background:"#0d0d0d", border:"1px solid #1a1a1a",
            borderRadius:"16px", padding:"16px", marginBottom:"12px",
          }}>
            <p style={{ fontWeight:700, fontSize:"13px", marginBottom:"12px" }}>
              New Task
            </p>

            {/* Type selector */}
            <div style={{ display:"flex", gap:"6px", marginBottom:"12px" }}>
              {TYPES.map(t=>(
                <button key={t.val} onClick={()=>setType(t.val)} style={{
                  flex:1, padding:"7px 4px", borderRadius:"8px",
                  fontSize:"11px", fontWeight:600, fontFamily:"inherit",
                  cursor:"pointer",
                  background: type===t.val ? t.bg : "transparent",
                  color:      type===t.val ? t.color : "#333",
                  border:`1px solid ${type===t.val ? t.color+"44" : "#1a1a1a"}`,
                  transition:"all 0.15s",
                }}>{t.label}</button>
              ))}
            </div>

            <input value={title} onChange={e=>setTitle(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addTask()}
              placeholder="Title *"
              style={{ width:"100%", padding:"10px 12px", background:"#070707",
                border:"1px solid #1c1c1c", borderRadius:"8px",
                color:"#fff", fontSize:"14px", marginBottom:"8px",
                outline:"none", fontFamily:"inherit" }}/>

            <textarea value={desc} onChange={e=>setDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ width:"100%", padding:"10px 12px", background:"#070707",
                border:"1px solid #1c1c1c", borderRadius:"8px",
                color:"#fff", fontSize:"13px", marginBottom:"8px",
                outline:"none", fontFamily:"inherit", resize:"vertical",
                color:"#aaa" }}/>

            <div style={{ display:"flex", alignItems:"center",
              gap:"8px", marginBottom:"12px" }}>
              <label style={{ color:"#333", fontSize:"11px",
                fontWeight:600, flexShrink:0 }}>Due date</label>
              <input type="date" value={due} onChange={e=>setDue(e.target.value)}
                style={{ flex:1, padding:"8px 10px", background:"#070707",
                  border:"1px solid #1c1c1c", borderRadius:"8px",
                  color:"#fff", fontSize:"13px", outline:"none",
                  fontFamily:"inherit", colorScheme:"dark" }}/>
            </div>

            <div style={{ display:"flex", gap:"7px" }}>
              <button onClick={addTask} style={{
                flex:1, padding:"10px", background:"#fff", color:"#000",
                border:"none", borderRadius:"8px", cursor:"pointer",
                fontWeight:700, fontSize:"13px", fontFamily:"inherit",
              }}>Add Task</button>
              <button onClick={()=>{setShowForm(false);setTitle("");setDesc("");setDue("");}} style={{
                padding:"10px 14px", background:"transparent",
                border:"1px solid #1c1c1c", color:"#444",
                borderRadius:"8px", cursor:"pointer",
                fontSize:"13px", fontFamily:"inherit",
              }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setShowForm(true)} style={{
            width:"100%", padding:"12px", background:"transparent",
            border:"1px dashed #1a1a1a", color:"#252525",
            borderRadius:"14px", cursor:"pointer",
            fontSize:"13px", fontFamily:"inherit",
            fontWeight:600, marginBottom:"12px",
            transition:"all 0.2s",
          }}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#555";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#252525";}}
          >+ Add Assignment / Project / Reminder</button>
        )}

        {/* Task list */}
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#1e1e1e" }}>
            <p style={{ fontSize:"32px", marginBottom:"8px" }}>✓</p>
            <p style={{ fontSize:"13px" }}>Nothing here</p>
          </div>
        )}

        {filtered.map((task, i) => {
          const ti      = typeInfo(task.type);
          const dl      = daysLeft(task.due);
          const overdue = isOverdue(task.due, task.done);

          return (
            <div key={task.id} className="task-card" style={{
              animationDelay:`${i*0.05}s`,
              background:"#0d0d0d",
              border:`1px solid ${overdue?"#3a1414": task.done?"#111":"#161616"}`,
              borderRadius:"14px", padding:"14px",
              marginBottom:"8px",
              opacity: task.done ? 0.5 : 1,
              transition:"opacity 0.2s",
            }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                {/* Checkbox */}
                <button className="check-btn" onClick={()=>toggleDone(task)} style={{
                  width:22, height:22, borderRadius:"6px", flexShrink:0,
                  border:`1.5px solid ${task.done?"#333":"#2a2a2a"}`,
                  background: task.done?"#1a1a1a":"transparent",
                  cursor:"pointer", display:"flex",
                  alignItems:"center", justifyContent:"center",
                  marginTop:"1px", transition:"border-color 0.15s",
                }}>
                  {task.done && <span style={{ color:"#4ade80", fontSize:"12px" }}>✓</span>}
                </button>

                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center",
                    gap:"7px", marginBottom:"4px", flexWrap:"wrap" }}>
                    {/* Type badge */}
                    <span style={{
                      fontSize:"9px", fontWeight:700, letterSpacing:"0.8px",
                      textTransform:"uppercase", padding:"2px 7px",
                      borderRadius:"4px", background:ti.bg, color:ti.color,
                      flexShrink:0,
                    }}>{ti.label}</span>
                    <p style={{
                      fontWeight:700, fontSize:"13px",
                      textDecoration: task.done?"line-through":"none",
                      color: task.done?"#333":"#fff",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{task.title}</p>
                  </div>

                  {task.desc && (
                    <p style={{ color:"#333", fontSize:"11px",
                      marginBottom:"6px", lineHeight:1.5 }}>{task.desc}</p>
                  )}

                  {/* Due + days left */}
                  {task.due && (
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <span style={{ color:"#252525", fontSize:"10px" }}>
                        {new Date(task.due+"T00:00:00").toLocaleDateString("en-IN",
                          {day:"numeric",month:"short",year:"numeric"})}
                      </span>
                      {dl && !task.done && (
                        <span style={{ fontSize:"10px", fontWeight:700,
                          color:dl.color }}>{dl.label}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Delete */}
                <button className="del-btn" onClick={()=>deleteTask(task.id)} style={{
                  background:"transparent", border:"none", color:"#1e1e1e",
                  cursor:"pointer", fontSize:"13px", padding:"2px 6px",
                  flexShrink:0, transition:"color 0.15s",
                }}>✕</button>
              </div>
            </div>
          );
        })}

      </main>
    </div>
  );
}