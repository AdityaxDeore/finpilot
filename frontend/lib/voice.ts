"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The browser's own speech engines: free, no key needed. Works in Chrome, Edge and Safari.
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Push-to-talk: `start()` listens once and calls `onText` with what was said. */
export function useVoiceInput(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => setSupported(recognitionCtor() !== null), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) cb.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false); // mic blocked or nothing heard: just stop, the user can tap again
    rec.current = r;
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { supported, listening, start, stop };
}

/** Reads text aloud. Markdown bold and the rupee sign are turned into words so it sounds natural. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text.replace(/\*\*/g, "").replace(/₹\s?([\d,]+(?:\.\d+)?)/g, "$1 rupees");
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "en-IN";
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

const PAGES: { path: string; label: string; words: RegExp }[] = [
  { path: "/transactions", label: "your transactions", words: /transaction|payment/ },
  { path: "/budgets", label: "your budgets", words: /budget/ },
  { path: "/goals", label: "your goals", words: /\bgoals?\b/ },
  { path: "/tax", label: "your tax page", words: /\btax/ },
  { path: "/financial-security", label: "Financial Security", words: /financial security|fraud|security score/ },
  { path: "/plan", label: "your plan", words: /\bplan\b|forecast/ },
  { path: "/household", label: "your household", words: /household|family/ },
  { path: "/invoices", label: "your invoices", words: /invoice/ },
  { path: "/connect", label: "the connect page", words: /connect|link (my )?(account|bank|google)/ },
  { path: "/profile", label: "your profile", words: /profile/ },
  { path: "/dashboard", label: "your dashboard", words: /dashboard|home|overview/ },
];

/** "show/open/go to/take me to X" -> the page to open. Plain questions return null and go to the Copilot. */
export function pageToOpen(text: string): { path: string; label: string } | null {
  const t = text.toLowerCase();
  if (!/\b(show|open|go to|take me|navigate|view|display)\b/.test(t)) return null;
  return PAGES.find((p) => p.words.test(t)) ?? null;
}

export function isRecentTransactionQuestion(text: string): boolean {
  return /\b(recent|latest|last)\b.*\btransactions?\b|\btransactions?\b.*\b(recent|latest|last)\b/i.test(text);
}
