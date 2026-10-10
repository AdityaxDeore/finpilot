"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CircleCheck, CircleX, Database, Globe, KeyRound, Repeat, ScanSearch } from "lucide-react";
import { api } from "@/lib/api";
import type { OpsEvent, OpsOverview, OpsStats } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";

const short = (m?: string | null) => (m ? m.split("/").pop() : "-");
const time = (ts: string) => new Date(ts).toLocaleTimeString();

function StatLine({ s }: { s: OpsStats | null | undefined }) {
  if (!s) return <span className="text-xs text-pewter">no calls yet</span>;
  return (
    <span className="text-xs text-graphite tnum">
      {s.calls} calls · <span className={s.success < 80 ? "text-rose-700" : "text-leaf"}>{s.success}% ok</span> · {s.avg_ms} ms avg{s.tokens ? ` · ${s.tokens} tokens` : ""}
    </span>
  );
}

function EventRow({ e }: { e: OpsEvent }) {
  const base = "flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-mist/60 px-3 py-2 text-xs last:border-0";
  const when = <span className="w-16 shrink-0 text-pewter tnum">{time(e.ts)}</span>;
  const run = e.run ? <span className="rounded bg-fog px-1.5 text-[10px] text-graphite">run {e.run}</span> : null;
  if (e.kind === "call")
    return (
      <li className={base}>
        {when}
        {e.ok ? <CircleCheck className="size-3.5 text-leaf" /> : <CircleX className="size-3.5 text-rose-600" />}
        <span className="font-semibold text-ink">{e.agent || "-"}</span>
        <ArrowRight className="size-3 text-pewter" />
        <span>{short(e.model)}</span>
        <span className="text-pewter">via {e.key}</span>
        <span className="ml-auto text-graphite tnum">{e.ms} ms{e.tokens ? ` · ${e.tokens} tok` : ""}{e.error ? ` · ${e.error}` : ""}</span>
        {run}
      </li>
    );
  if (e.kind === "fallback")
    return (
      <li className={cn(base, "bg-amber-50")}>
        {when}
        <Repeat className="size-3.5 text-amber-700" />
        <span className="font-semibold text-ink">{e.agent}</span>
        <span>fell back from {short(e.model)}</span><ArrowRight className="size-3" /><span>{short(e.to)}</span>
        {e.reason && <span className="text-pewter">({e.reason})</span>}
        {run}
      </li>
    );
  if (e.kind === "cache")
    return (
      <li className={base}>{when}<Database className="size-3.5 text-pewter" /><span className="font-semibold text-ink">{e.agent}</span><span>answered from cache (0 tokens)</span>{run}</li>
    );
  if (e.kind === "search")
    return (
      <li className={base}>{when}<Globe className="size-3.5 text-pewter" /><span className="font-semibold text-ink">{e.agent}</span><span>{e.op}: {e.query}</span><span className="text-pewter">{e.sites?.join(", ")}</span>{run}</li>
    );
  return <li className={base}>{when}<ScanSearch className="size-3.5 text-pewter" /><span>Investigation started</span>{run}</li>;
}

export default function AgentOpsPage() {
  const [data, setData] = useState<OpsOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api.opsOverview().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(String(e.message ?? e))), []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <span className="flex size-8 items-center justify-center rounded-full bg-lime"><Activity className="size-4" /></span>
              Agent Ops
            </CardTitle>
            <CardDescription>Which keys exist, which agent uses which model, what each call cost, what the web agents searched, and every retry and fallback. Refreshes every 5 seconds. Keys are shown masked.</CardDescription>
          </div>
          <Link href="/evidence-room" className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-4 py-2 text-sm text-ink hover:bg-fog sm:ml-auto">
            <ScanSearch className="size-4" /> Run Evidence Council
          </Link>
        </CardHeader>
        {err && <CardContent className="text-sm text-rose-700">{err}</CardContent>}
        {data && (
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            {[["Tokens used", data.totals.tokens], ["Fallbacks", data.totals.fallbacks], ["Cache hits (free)", data.totals.cache_hits]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-fog p-3"><p className="font-display text-2xl font-semibold tnum text-ink">{v}</p><p className="text-[11px] text-graphite">{k}</p></div>
            ))}
          </CardContent>
        )}
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" /> API keys</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {data.keys.map((k) => (
                <div key={k.env} className="rounded-2xl border border-mist p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", k.configured ? "bg-leaf" : "bg-pewter")} />
                    <span className="text-sm font-semibold text-ink">{k.provider}</span>
                    <span className="ml-auto font-mono text-[11px] text-graphite">{k.masked ?? "not set"}</span>
                  </div>
                  <p className="font-mono text-[10px] text-pewter">{k.env}</p>
                  <p className="mt-1 text-xs text-graphite">{k.use}</p>
                  <div className="mt-1"><StatLine s={k.stats} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agents, their jobs and models</CardTitle>
              <CardDescription>Each agent has its own task prompt and model. If the model fails or times out (12 s) the backup is tried; if that fails too, the agent keeps its plain rule result.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-pewter"><tr><th className="py-1 pr-3">Agent</th><th className="pr-3">Task</th><th className="pr-3">Model → backup</th><th>Behaviour</th></tr></thead>
                <tbody>
                  {data.agents.map((a) => (
                    <tr key={a.agent} className="border-t border-mist/60 align-top">
                      <td className="py-2 pr-3 font-semibold text-ink">{a.agent}</td>
                      <td className="pr-3 text-graphite">{a.task}</td>
                      <td className="pr-3 text-graphite">{short(a.model)} <span className="text-pewter">→ {short(a.backup)}</span></td>
                      <td><StatLine s={a.stats} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe className="size-4" /> Web searches</CardTitle><CardDescription>What Tavily was asked and which sites it returned.</CardDescription></CardHeader>
            <CardContent>
              {data.searches.length === 0 ? <p className="text-xs text-graphite">No searches yet. Run the Evidence Council or use Web Intel.</p> : (
                <ul className="grid gap-2">
                  {data.searches.map((s, i) => (
                    <li key={i} className="rounded-xl border border-mist p-2.5 text-xs">
                      <p className="font-semibold text-ink">{s.query}</p>
                      <p className="text-graphite">{s.agent} · {s.op} · {s.results} results · {time(s.ts)}</p>
                      <div className="mt-1 flex flex-wrap gap-1">{s.sites?.map((d) => <span key={d} className="rounded-full bg-fog px-2 py-0.5 text-[10px] text-graphite">{d}</span>)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Live activity</CardTitle><CardDescription>Newest first: calls, retries, fallbacks and cache hits.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {data.events.length === 0 ? <p className="px-6 pb-6 text-xs text-graphite">Nothing yet.</p> : <ul>{data.events.map((e, i) => <EventRow key={i} e={e} />)}</ul>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
