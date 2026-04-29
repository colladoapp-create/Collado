import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "sans-serif"
    }}>
      <div style={{
        background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px",
        padding: "40px", width: "100%", maxWidth: "400px"
      }}>
        <h1 style={{ color: "#fff", textAlign: "center", marginBottom: "8px" }}>
          CollaDO
        </h1>
        <p style={{ color: "#888", textAlign: "center", marginBottom: "32px" }}>
          {isLogin ? "Sign in to your account" : "Create a new account"}
        </p>

        {error && (
          <div style={{
            background: "#2a0000", border: "1px solid #ff4444", color: "#ff4444",
            padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%", padding: "12px", background: "#0a0a0a", border: "1px solid #333",
            borderRadius: "8px", color: "#fff", fontSize: "16px",
            marginBottom: "12px", boxSizing: "border-box"
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%", padding: "12px", background: "#0a0a0a", border: "1px solid #333",
            borderRadius: "8px", color: "#fff", fontSize: "16px",
            marginBottom: "20px", boxSizing: "border-box"
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", background: "#fff", color: "#000",
            border: "none", borderRadius: "8px", fontSize: "16px",
            fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
        </button>

        <p style={{ color: "#888", textAlign: "center", marginTop: "20px", fontSize: "14px" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}