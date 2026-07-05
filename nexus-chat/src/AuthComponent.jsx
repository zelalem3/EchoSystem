import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import "./AuthComponent.css";

function AuthComponent({ setLoggedin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const auth = getAuth();
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      let userCredential;

      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      setUser(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  if (user) {
    setLoggedin(true);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🔥</div>

        <h1>{isSignup ? "Create Account" : "Welcome Back"}</h1>
        <p className="subtitle">
          {isSignup
            ? "Create your account to get started."
            : "Sign in to continue."}
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="auth-btn" type="submit">
            {isSignup ? "Create Account" : "Login"}
          </button>
        </form>

        <div className="switch">
          {isSignup ? "Already have an account?" : "Don't have an account?"}

          <span onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? " Login" : " Sign Up"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuthComponent;