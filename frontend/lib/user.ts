"use client";

/**
 * Per-viewer demo user id. The backend seeds three demo personas
 * (demo-priya, demo-arjun, demo-meera -- see backend/app/ingest/personas.py)
 * and every client-side call defaults to demo-priya. Stored in localStorage
 * purely as a per-viewer convenience (never read by the server) -- swapped
 * for the real Firebase user id once accounts map to backend user records.
 */
const STORAGE_KEY = "finpilot:user_id";
export const DEFAULT_USER_ID = "demo-priya";

/** Fired on `window` whenever setUserId changes the active persona, so
 * useUserId() (lib/hooks.ts) can re-render and dependent useAsync() fetches
 * re-run -- see the persona switcher in components/NavShell.tsx. */
export const USER_ID_CHANGE_EVENT = "finpilot:user_id_changed";

export interface DemoPersona {
  id: string;
  label: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "demo-priya", label: "Priya" },
  { id: "demo-arjun", label: "Arjun" },
  { id: "demo-meera", label: "Meera" },
];

/** The signed-in Firebase user's id, mirrored into localStorage by
 * setAuthUserId() so getUserId() stays synchronous. When present it wins
 * over the demo persona: a signed-in user only ever sees their own data. */
const AUTH_USER_KEY = "finpilot:auth_user_id";

export function isDemoUserId(id: string): boolean {
  return DEMO_PERSONAS.some((p) => p.id === id);
}

export function getUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  try {
    return (
      window.localStorage.getItem(AUTH_USER_KEY) ??
      window.localStorage.getItem(STORAGE_KEY) ??
      DEFAULT_USER_ID
    );
  } catch {
    return DEFAULT_USER_ID;
  }
}

/** Called from the Firebase auth listener (components/SignInButton.tsx) with
 * the signed-in user's id, or null on sign-out. */
export function setAuthUserId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      if (window.localStorage.getItem(AUTH_USER_KEY) === id) return;
      window.localStorage.setItem(AUTH_USER_KEY, id);
    } else {
      if (window.localStorage.getItem(AUTH_USER_KEY) === null) return;
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(USER_ID_CHANGE_EVENT));
}

export function setUserId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore -- private browsing / blocked storage
  }
  window.dispatchEvent(new CustomEvent(USER_ID_CHANGE_EVENT));
}

/** Privacy preference: when on, the copilot never sends financial data to
 * the Gemini API -- every answer comes from the local rule-based router
 * instead. Per-viewer, localStorage-backed, same pattern as the persona id
 * above. See the Security page's "Data & privacy" section. */
const OFFLINE_ONLY_KEY = "finpilot:copilot_offline_only";

export function getOfflineOnly(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OFFLINE_ONLY_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOfflineOnly(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_ONLY_KEY, value ? "true" : "false");
  } catch {
    // ignore -- private browsing / blocked storage
  }
}
