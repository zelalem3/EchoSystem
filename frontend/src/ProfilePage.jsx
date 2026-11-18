import React, { useEffect, useState } from "react";
import { updateProfile as updateFirebaseProfile } from "firebase/auth";
import { auth } from "./firebase";
import { socket } from "./socket";

export function ProfilePage({ user, onBack }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = () => {
      socket.emit("getProfile", (result) => {
        if (!active) return;
        if (!result?.ok) {
          setError(result?.error || "Unable to load your profile.");
        } else {
          setDisplayName(result.profile.displayName || "");
          setBio(result.profile.bio || "");
        }
        setLoading(false);
      });
    };

    if (socket.connected) loadProfile();
    else {
      socket.on("connect", loadProfile);
    }

    return () => {
      active = false;
      socket.off("connect", loadProfile);
    };
  }, []);

  const handleSave = (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    socket.emit(
      "updateProfile",
      { displayName: displayName.trim(), bio: bio.trim() },
      async (result) => {
        if (!result?.ok) {
          setError(result?.error || "Unable to save your profile.");
          setSaving(false);
          return;
        }

        try {
          if (auth.currentUser) {
            await updateFirebaseProfile(auth.currentUser, {
              displayName: result.profile.displayName,
            });
          }
          setDisplayName(result.profile.displayName);
          setBio(result.profile.bio);
          setSaved(true);
        } catch (saveError) {
          setError(saveError.message || "Profile saved, but account name could not be updated.");
        } finally {
          setSaving(false);
        }
      }
    );
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
        >
          Back to chat
        </button>

        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-md)] sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Your account
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--color-text)]">
              Profile
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Add a name and short introduction so people in your rooms know who you are.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading profile...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="mb-1.5 block text-sm font-semibold text-[var(--color-text)]"
                >
                  Display name
                </label>
                <input
                  id="profile-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={60}
                  required
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200/80"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-1.5 block text-sm font-semibold text-[var(--color-text)]"
                >
                  Email
                </label>
                <input
                  id="profile-email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 text-sm text-[var(--color-text-muted)]"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-bio-edit"
                  className="mb-1.5 block text-sm font-semibold text-[var(--color-text)]"
                >
                  About you
                </label>
                <textarea
                  id="profile-bio-edit"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={280}
                  rows={4}
                  placeholder="A short introduction (optional)"
                  className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200/80"
                />
                <p className="mt-1 text-right text-xs text-[var(--color-text-muted)]">
                  {bio.length}/280
                </p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              )}
              {saved && (
                <p role="status" className="text-sm text-[var(--color-success)]">
                  Profile saved.
                </p>
              )}
              <button
                type="submit"
                disabled={saving || !displayName.trim()}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
