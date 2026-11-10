import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (user) {
      setLoggedin(true);
    }
  }, [user, setLoggedin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const auth = getAuth();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
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
      setError(err.message.replace("Firebase:", "").trim());
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-illustration" aria-hidden="true">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="panel-preview">
          <div className="preview-header">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-body">
            <div className="preview-bubble bubble-me">Hi team!</div>
            <div className="preview-bubble bubble-them">Welcome to EchoSystem.</div>
            <div className="preview-bubble bubble-me">Let’s build something amazing.</div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="brand-mark">E</div>
        <h1 className="title">{isSignup ? "Create your account" : "Welcome back"}</h1>

        <p className="subtitle">
          {isSignup
            ? "Start your next collaboration in a space built for momentum."
            : "Sign in to continue your conversations and keep ideas flowing."}
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="auth-btn" type="submit">
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <p className="switch">
          {isSignup ? "Already have an account?" : "Don’t have an account?"}
          <span onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? " Sign in" : " Create one"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default AuthComponent;