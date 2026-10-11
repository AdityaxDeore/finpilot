"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { api, clearApiCache } from "@/lib/api";
import { DATA_CHANGED_EVENT, useAsync, useUserId } from "@/lib/hooks";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";
import type { PayCheck, PayReview } from "@/lib/types";

const VERDICT = {
  secure: { label: "Secure", tone: "bg-emerald-100 text-emerald-800", Icon: ShieldCheck },
  review: { label: "Please review", tone: "bg-amber-100 text-amber-800", Icon: ShieldAlert },
  suspicious: { label: "Check this payment", tone: "bg-rose-100 text-rose-800", Icon: ShieldAlert },
} as const;

const CHECK_ICON: Record<PayCheck["status"], { Icon: typeof Info; tone: string }> = {
  pass: { Icon: CheckCircle2, tone: "text-emerald-600" },
  warn: { Icon: AlertTriangle, tone: "text-amber-600" },
  fail: { Icon: XCircle, tone: "text-rose-600" },
  info: { Icon: Info, tone: "text-pewter" },
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-3">
      <p className="text-[11px] text-graphite">{label}</p>
      <p className="mt-0.5 font-display text-base font-medium text-ink tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-pewter">{sub}</p>}
    </div>
  );
}

export function Impact({ r }: { r: PayReview["impact"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile label="Balance after" value={formatCurrency(r.balance_after)} sub={`was ${formatCurrency(r.balance_before)}`} />
      <Tile label="Spent this month" value={formatCurrency(r.month_spend_after)} sub={r.spend_vs_avg_pct == null ? undefined : `${r.spend_vs_avg_pct >= 0 ? "+" : ""}${r.spend_vs_avg_pct}% vs a usual month`} />
      <Tile label={`${r.category.replace("_", " ")} this month`} value={formatCurrency(r.category_month_after)} sub={r.category_avg ? `usual ${formatCurrency(r.category_avg)}` : undefined} />
      <Tile label="Budget used" value={r.budget_used_pct == null ? "No budget" : `${r.budget_used_pct}%`} sub={r.runway_months == null ? undefined : `${r.runway_months} months of essentials left`} />
    </div>
  );
}

/** Latest heavy or unusual UPI payment, with the automatic security check and what it did to the month. */
export function PaymentReviewCard() {
  const userId = useUserId();
  const { data, reload } = useAsync(useCallback(() => api.payReviews(userId, 1), [userId]), [userId]);
  const [busy, setBusy] = useState(false);
  const item = data?.[0];
  if (!item) return null;
  const { review } = item;
  const v = VERDICT[review.verdict];

  async function mark(status: "confirmed" | "reported") {
    setBusy(true);
    try {
      await api.setPayReviewStatus(userId, item!.id, status);
      clearApiCache();
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn(review.verdict === "suspicious" && "border-rose-300", review.verdict === "secure" && "border-emerald-200")}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", v.tone)}><v.Icon className="size-5" /></span>
            <div>
              <p className="text-xs text-graphite">{review.heavy ? "Heavy payment just made" : "Unusual payment just made"} · {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              <h2 className="font-display text-lg font-medium text-ink">{formatCurrency(item.amount)} to {item.payee_name}</h2>
              <p className="mt-0.5 max-w-xl text-sm text-graphite">{review.headline}</p>
            </div>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", v.tone)}>{v.label}</span>
        </div>

        <Impact r={review.impact} />

        <div className="grid gap-4 md:grid-cols-2">
          <ul className="flex flex-col gap-2">
            {review.checks.map((c) => {
              const { Icon, tone } = CHECK_ICON[c.status];
              return (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
                  <span><b className="font-medium text-ink">{c.label}.</b> <span className="text-graphite">{c.detail}</span></span>
                </li>
              );
            })}
          </ul>
          <ul className="flex flex-col gap-2 text-sm text-graphite">
            {review.insights.map((s) => <li key={s} className="rounded-lg bg-black/[0.03] px-3 py-2">{s}</li>)}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {item.status === "open" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => mark("confirmed")}>It was me</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => mark("reported")}>I did not make this</Button>
            </>
          ) : (
            <p className="text-sm text-graphite">{item.status === "confirmed" ? "You confirmed this payment." : "You reported this payment. It is flagged for review in your transactions."}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
