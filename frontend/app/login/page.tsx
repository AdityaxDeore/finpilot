"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthChange,
  getMfaResolver,
  finishTotpSignIn,
  authErrorMessage,
} from "@/lib/firebase/auth";
import type { MultiFactorResolver, User } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { FinPilotLogo } from "@/components/FinPilotLogo";

export default function LoginPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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
      router.push("/dashboard");
    } catch (err: unknown) {
      const mfa = getMfaResolver(err);
      if (mfa) {
        setResolver(mfa);
        return;
      }
      setError(authErrorMessage(err, "Failed to sign in with Google."));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        setSuccess("Account created successfully! Redirecting...");
      } else {
        await signInWithEmail(email, password);
        setSuccess("Signed in successfully! Redirecting...");
      }
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: unknown) {
      const mfa = getMfaResolver(err);
      if (mfa) {
        setResolver(mfa);
        setSuccess(null);
        return;
      }
      setError(authErrorMessage(err, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaCode(e: React.FormEvent) {
    e.preventDefault();
    if (!resolver) return;
    setError(null);
    setLoading(true);
    try {
      await finishTotpSignIn(resolver, mfaCode.trim());
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(authErrorMessage(err, "Invalid code."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
      <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-8 shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/">
            <FinPilotLogo variant="horizontal" size={32} showWordmark={true} />
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 text-[11px] font-medium text-amber-600 mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Firebase Auth • hackmatrix-3764f</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink pt-2">
            {currentUser
              ? "You are signed in"
              : isSignUp
              ? "Create your FinPilot Account"
              : "Sign in to FinPilot"}
          </h1>
          <p className="text-xs text-graphite">
            {currentUser
              ? `Connected as ${currentUser.email || currentUser.uid}`
              : "Secure authentication powered by Google Firebase."}
          </p>
        </div>

        {currentUser ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-xl bg-fog border border-mist text-xs text-graphite">
              <p className="font-mono text-ink font-semibold">{currentUser.displayName || currentUser.email}</p>
              <p className="text-[11px] text-pewter mt-1">UID: {currentUser.uid}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                className="flex-1 py-2.5 text-xs font-semibold"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="secondary"
                className="py-2.5 text-xs font-semibold"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : resolver ? (
          <form onSubmit={handleMfaCode} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-graphite mb-1">
                6-digit code from your authenticator app
              </label>
              <input
                inputMode="numeric"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg bg-fog border border-mist px-3 py-2 text-xs text-ink placeholder-pewter focus:outline-none focus:ring-1 focus:ring-ember"
              />
            </div>
            {error && (
              <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-700">
                {error}
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-xs font-semibold"
              disabled={loading || mfaCode.length !== 6}
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>
        ) : (
          <>
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2.5 py-2.5 text-xs font-semibold border-black/[0.12] hover:bg-fog"
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

            <div className="relative my-4 flex items-center justify-center">
              <span className="h-px w-full bg-mist" />
              <span className="absolute bg-white px-2.5 text-[10px] text-pewter uppercase tracking-widest">
                or with email
              </span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-graphite mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg bg-fog border border-mist px-3 py-2 text-xs text-ink placeholder-pewter focus:outline-none focus:ring-1 focus:ring-ember"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-graphite mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg bg-fog border border-mist px-3 py-2 text-xs text-ink placeholder-pewter focus:outline-none focus:ring-1 focus:ring-ember"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-700">
                  {success}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 text-xs font-semibold"
                disabled={loading}
              >
                {loading
                  ? "Authenticating..."
                  : isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </Button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs text-graphite hover:text-ember transition-colors"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Need an account? Sign up here"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
