"use client";

import { flash, scrollCommand } from "@/lib/voice";

export type VoiceAction = { type: "navigate"; path: string } | { type: "scroll"; to: string } | { type: "click"; id: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DANGEROUS = /delete|remove|pay\b|send|submit|confirm|disconnect|sign.?out|log.?out|clear|reset|transfer|unlink|revoke/i; // the voice agent never presses these
const label = (el: Element) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);

/** What the user can currently see: headings, pressable controls (numbered on the page) and the main text. */
export function snapshotScreen() {
  document.querySelectorAll("[data-voice-id]").forEach((e) => e.removeAttribute("data-voice-id"));
  const main = document.querySelector("main") ?? document.body;
  const seen = new Set<string>();
  const controls: { id: number; label: string }[] = [];
  main.querySelectorAll("a[href],button,[role=tab]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const l = label(el);
    if (!r.width || !r.height || !l || seen.has(l) || controls.length >= 50) return;
    seen.add(l);
    const id = controls.length + 1;
    el.setAttribute("data-voice-id", String(id));
    controls.push({ id, label: l });
  });
  return {
    title: document.title.slice(0, 120),
    headings: [...main.querySelectorAll("h1,h2,h3")].map((h) => (h.textContent ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 30),
    controls,
    text: ((main as HTMLElement).innerText ?? "").replace(/\n{2,}/g, "\n").slice(0, 2500),
  };
}

/** Does what the voice agent decided, one step at a time, so the user can follow it on screen. */
export async function runActions(actions: VoiceAction[], push: (path: string) => void) {
  for (const a of actions) {
    if (a.type === "navigate") {
      push(a.path);
      const end = Date.now() + 6000;
      while (!location.pathname.startsWith(a.path) && Date.now() < end) await sleep(100);
      await sleep(1000);
    } else if (a.type === "scroll") {
      const dir = a.to.toLowerCase();
      scrollCommand(/^(top|bottom|up|down)$/.test(dir) ? `scroll ${dir}` : `scroll to ${dir}`);
      await sleep(900);
    } else {
      const el = document.querySelector(`[data-voice-id="${a.id}"]`);
      if (!el || DANGEROUS.test(label(el))) continue;
      flash(el);
      await sleep(900);
      (el as HTMLElement).click();
      await sleep(700);
    }
  }
}
