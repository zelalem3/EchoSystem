import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { socket } from "./socket";
import "./AuthComponent.css";

function AuthComponent() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const auth = getAuth();

    setError("");
    if (!email || !password || (isSignup && !displayName.trim())) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const cleanName = displayName.trim();
        const cleanBio = bio.trim();
        await updateFirebaseProfile(userCredential.user, {
          displayName: cleanName,
        });

        await new Promise((resolve, reject) => {
          let timeout;
          let settled = false;
          const finish = (saveError) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            socket.off("connect", saveProfile);
            if (saveError) reject(saveError);
            else resolve();
          };
          const saveProfile = () => {
            socket.off("connect", saveProfile);
            socket.emit(
              "updateProfile",
              { displayName: cleanName, bio: cleanBio },
              (result) => {
                if (result?.ok) finish();
                else finish(new Error(result?.error || "Unable to save your profile."));
              }
            );
          };

          timeout = setTimeout(() => {
            finish(
              new Error(
                "Account created, but the profile could not be saved. You can update it from your profile page."
              )
            );
          }, 10_000);
          if (socket.connected) {
            saveProfile();
          } else {
            socket.on("connect", saveProfile);
          }
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace("Firebase:", "").trim());
    } finally {
      setSubmitting(false);
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
          {isSignup && (
            <>
              <div className="input-group">
                <label htmlFor="display-name">Display name</label>
                <input
                  id="display-name"
                  type="text"
                  placeholder="How should people know you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="profile-bio">About you (optional)</label>
                <textarea
                  id="profile-bio"
                  placeholder="A short introduction"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
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