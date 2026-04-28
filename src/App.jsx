import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Reminders from "./Reminders";
import Pomodoro from "./Pomodoro";

export default function App() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState("dashboard");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#070707", display:"flex",
      alignItems:"center", justifyContent:"center", color:"#333",
      fontFamily:"'Outfit',sans-serif", fontSize:"13px" }}>loading...</div>
  );

  if (!user) return <Auth />;

  if (page === "dashboard") return <Dashboard user={user} onNavigate={setPage} />;
  if (page === "reminders") return <Reminders user={user} onNavigate={setPage} />;
  if (page === "pomodoro")  return <Pomodoro onNavigate={setPage} />;
  return <Dashboard user={user} onNavigate={setPage} />;
}