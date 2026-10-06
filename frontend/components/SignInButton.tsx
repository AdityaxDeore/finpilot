"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthChange,
} from "@/lib/firebase/auth";
import type { User } from "firebase/auth";

/**
 * Firebase Authentication component supporting Google OAuth and Email/Password login.
 * Automatically synchronizes auth state to the active FinPilot session.
 */
export function SignInButton() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      setShowModal(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setShowModal(false);
      setEmail("");
      setPassword("");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err: unknown) {
      console.error("Sign out failed", err);
    }
  }

  if (currentUser) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/20 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-emerald-300 max-w-32 truncate" title={currentUser.email || currentUser.uid}>
            {currentUser.displayName || currentUser.email || "Firebase User"}
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4 20h16L12 2zm0 4.5l5.5 12.5H6.5L12 6.5z"/>
          </svg>
          Sign in
        </Button>
        {error ? <span className="text-[10px] text-rose-400">{error}</span> : null}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-semibold text-sm">Firebase Auth</span>
                <span className="text-zinc-500 text-xs">(hackmatrix-1c5a2)</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isSignUp
                ? "Create a new account for your FinPilot workspace."
                : "Sign in to access your synchronized financial intelligence."}
            </p>

            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative my-2 flex items-center justify-center">
              <span className="h-px w-full bg-zinc-800" />
              <span className="absolute bg-zinc-900 px-2 text-[10px] text-zinc-500 uppercase tracking-widest">
                or email
              </span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg bg-zinc-800/80 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg bg-zinc-800/80 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {error && (
                <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-300">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2 text-xs font-semibold"
                disabled={loading}
              >
                {loading ? "Authenticating..." : isSignUp ? "Sign Up with Email" : "Sign In with Email"}
              </Button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-amber-300 underline"
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
