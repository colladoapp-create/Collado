import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

function validatePassword(password) {
  return {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number:    /[0-9]/.test(password),
  };
}

function PasswordStrength({ password }) {
  const checks = validatePassword(password);
  const passed = Object.values(checks).filter(Boolean).length;
  const color  = passed === 3 ? "#4ade80" : passed === 2 ? "#facc15" : "#f87171";
  const label  = passed === 3 ? "Strong" : passed === 2 ? "Medium" : "Weak";
  if (!password) return null;
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            flex: 1, height: "3px", borderRadius: "2px",
            background: i < passed ? color : "#222",
            transition: "background 0.2s",
          }}/>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", color: "#444" }}>
          {!checks.length && "8+ chars · "}
          {!checks.uppercase && "uppercase · "}
          {!checks.number && "number"}
        </span>
        <span style={{ fontSize: "10px", color, fontWeight: 700 }}>{label}</span>
      </div>
    </div>
  );
}

export default function Auth() {
  const [isLogin,  setIsLogin]  = useState(true);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const friendlyError = (code) => {
    switch (code) {
      case "auth/user-not-found":       return "No account found with this email.";
      case "auth/wrong-password":       return "Incorrect password. Try again.";
      case "auth/invalid-credential":   return "Incorrect email or password.";
      case "auth/email-already-in-use": return "An account with this email already exists.";
      case "auth/invalid-email":        return "Please enter a valid email address.";
      case "auth/too-many-requests":    return "Too many attempts. Please wait a moment.";
      case "auth/popup-closed-by-user": return "Google sign-in was cancelled.";
      default:                          return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!isLogin) {
      const checks = validatePassword(password);
      if (!checks.length)    return setError("Password must be at least 8 characters.");
      if (!checks.uppercase) return setError("Password needs at least one uppercase letter.");
      if (!checks.number)    return setError("Password needs at least one number.");
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", background: "#0d0d0d",
    border: "1px solid #1e1e1e", borderRadius: "10px", color: "#fff",
    fontSize: "15px", boxSizing: "border-box", outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#070707", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit', sans-serif", padding: "20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #333; }
        input:focus { border-color: #333 !important; }
      `}</style>

      <div style={{
        background: "#0d0d0d", border: "1px solid #1a1a1a",
        borderRadius: "20px", padding: "36px 32px",
        width: "100%", maxWidth: "400px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            CollaDO
          </h1>
          <p style={{ color: "#333", fontSize: "13px", marginTop: "6px" }}>
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#1a0000", border: "1px solid #3a0000",
            color: "#f87171", padding: "10px 14px", borderRadius: "10px",
            marginBottom: "16px", fontSize: "13px",
          }}>
            {error}
          </div>
        )}

        {/* Google Button */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: "100%", padding: "12px", background: "#111",
          border: "1px solid #1e1e1e", borderRadius: "10px",
          color: "#fff", fontSize: "14px", fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          marginBottom: "20px",
        }}
          onMouseOver={e => e.currentTarget.style.borderColor = "#333"}
          onMouseOut={e  => e.currentTarget.style.borderColor = "#1e1e1e"}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.8 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.7 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C37.6 38.8 44 33 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "#1a1a1a" }}/>
          <span style={{ color: "#2a2a2a", fontSize: "11px", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "#1a1a1a" }}/>
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: "10px" }}
        />

        {/* Password */}
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <input
            type={showPass ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ ...inputStyle, paddingRight: "52px" }}
          />
          <button onClick={() => setShowPass(!showPass)} style={{
            position: "absolute", right: "12px", top: "50%",
            transform: "translateY(-50%)", background: "none",
            border: "none", color: "#444", cursor: "pointer",
            fontSize: "12px", fontFamily: "inherit", fontWeight: 600,
          }}>
            {showPass ? "Hide" : "Show"}
          </button>
        </div>

        {/* Password strength (signup only) */}
        {!isLogin && <PasswordStrength password={password} />}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", padding: "13px", background: "#fff", color: "#000",
          border: "none", borderRadius: "10px", fontSize: "15px",
          fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1, fontFamily: "inherit", marginBottom: "16px",
        }}>
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
        </button>

        {/* Toggle */}
        <p style={{ color: "#333", textAlign: "center", fontSize: "13px" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(""); setPassword(""); }}
            style={{ color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}