"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

const OVERRIDE = "finpilot_simple"; // "1" | "0" | absent = decide from the questionnaire
const NOW = "finpilot_simple_now"; // what is actually in effect (read via getSimpleNow in i18n.ts)
const listeners = new Set<() => void>();

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** Simple view = very few big numbers and a talking assistant. On for anyone who said they are not fully comfortable reading. */
export function useSimpleMode(userId: string): [boolean, (on: boolean) => void] {
  const profile = useAsync(useCallback(() => api.profile(userId), [userId]), [userId]);
  const override = useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => read(OVERRIDE), () => null);
  const comfort = profile.data?.answers.comfort;
  const simple = override ? override === "1" : !!comfort && comfort !== "I am comfortable";
  useEffect(() => {
    try {
      localStorage.setItem(NOW, simple ? "1" : "0");
    } catch {}
  }, [simple]);
  const set = useCallback((on: boolean) => {
    try {
      localStorage.setItem(OVERRIDE, on ? "1" : "0");
    } catch {}
    listeners.forEach((l) => l());
  }, []);
  return [simple, set];
}
