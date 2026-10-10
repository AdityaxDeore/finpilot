"use client";

import { useState } from "react";
import { Globe, Loader2, Map as MapIcon, Search, FileText, Network } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";

type Kind = "search" | "extract" | "crawl" | "map";
const MODES: { id: Kind; label: string; hint: string; placeholder: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", hint: "Ask the web a money question and get a sourced answer, e.g. is a merchant legitimate or what a scheme offers.", placeholder: "Is Quickcash Global Ltd a legitimate lender?", icon: Search },
  { id: "extract", label: "Extract", hint: "Read one page (a bank offer, a policy, a notice) as clean text.", placeholder: "https://www.rbi.org.in/…", icon: FileText },
  { id: "crawl", label: "Crawl", hint: "Follow links from a site and read the pages it contains.", placeholder: "https://www.sebi.gov.in/…", icon: Network },
  { id: "map", label: "Map", hint: "List the pages a site has, without reading them.", placeholder: "https://www.incometax.gov.in", icon: MapIcon },
];

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export default function WebIntelPage() {
  const [kind, setKind] = useState<Kind>("search");
  const [input, setInput] = useState("");
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const mode = MODES.find((m) => m.id === kind)!;

  async function run() {
    if (!input.trim() || busy) return;
    setBusy(true), setErr(null), setAnswer(null), setRows([]);
    try {
      const body: Record<string, string> = kind === "search" ? { query: input.trim(), depth: deep ? "advanced" : "basic" } : { url: input.trim() };
      const r = await api.web(kind, body);
      setAnswer(r.answer ?? null);
      setRows(r.results ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <span className="flex size-8 items-center justify-center rounded-full bg-lime"><Globe className="size-4" /></span>
            Web Intel
          </CardTitle>
          <CardDescription>Check things on the live web before you trust them or pay: merchants, offers, notices. Powered by Tavily.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => { setKind(m.id); setRows([]); setAnswer(null); setErr(null); }}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm", kind === m.id ? "border-ink bg-ink text-white" : "border-mist bg-white text-ink hover:bg-fog")}>
                <m.icon className="size-4" /> {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-graphite">{mode.hint}</p>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode.placeholder}
              className="h-10 flex-1 rounded-full border border-mist bg-white px-4 text-sm outline-none focus:border-ink" />
            <Button type="submit" disabled={busy || !input.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <mode.icon className="size-4" />} {mode.label}</Button>
          </form>
          {kind === "search" && (
            <label className="flex items-center gap-2 text-xs text-graphite">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Deep search (slower, more thorough)
            </label>
          )}
        </CardContent>
      </Card>

      {err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</p>}
      {answer && (
        <Card>
          <CardHeader><CardTitle className="text-base">Answer</CardTitle></CardHeader>
          <CardContent className="text-sm text-ink">{answer}</CardContent>
        </Card>
      )}
      {rows.length > 0 && (
        <ul className="grid gap-3">
          {rows.map((r, i) => {
            const url = str(r.url) || (typeof r === "string" ? (r as string) : "");
            const body = str(r.content) || str(r.raw_content);
            return (
              <li key={i} className="rounded-2xl border border-mist bg-white p-4">
                <a href={url} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-ink underline-offset-2 hover:underline">{str(r.title) || url}</a>
                {str(r.title) && <p className="break-all text-[11px] text-pewter">{url}</p>}
                {body && <p className="mt-1.5 line-clamp-6 whitespace-pre-line text-xs text-graphite">{body}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
