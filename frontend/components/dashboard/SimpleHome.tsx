"use client";

import Link from "next/link";
import { Link2, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { formatCurrency } from "@/lib/format";
import { openAssistant } from "@/lib/copilotBus";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/voice";

function Bar({ label, amount, max, tone }: { label: string; amount: number; max: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-medium text-ink sm:text-xl">{label}</p>
        <p className="font-display text-3xl font-semibold text-ink sm:text-4xl">{formatCurrency(amount)}</p>
      </div>
      <div className="mt-2 h-5 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.max(3, (amount / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

/** The dashboard for people who read little: three big numbers, one picture, and a button to just talk. */
export function SimpleHome({ name, income, spent, connected, onFullView }: { name?: string; income: number; spent: number; connected: boolean; onFullView: () => void }) {
  const { t } = useT();
  const left = income - spent;
  const max = Math.max(income, spent);

  function listen() {
    speak(`${t("home.in")} ${formatCurrency(income)}. ${t("home.out")} ${formatCurrency(spent)}. ${t("home.left")} ${formatCurrency(Math.max(0, left))}. ${left >= 0 ? t("home.good") : t("home.careful")}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-6">
      <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
        {t("home.hello")}
        {name ? `, ${name}` : ""}
      </h1>

      <Button onClick={openAssistant} className="h-auto w-full gap-3 rounded-3xl bg-lime py-6 text-xl font-semibold text-ink hover:bg-lime/85">
        <Mic className="size-7" /> {t("home.talk")}
      </Button>
      <p className="-mt-3 text-center text-sm text-graphite">{t("home.talk_hint")}</p>

      {connected ? (
        <section className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-pewter">{t("home.this_month")}</p>
          <Bar label={t("home.in")} amount={income} max={max} tone="bg-emerald-500" />
          <Bar label={t("home.out")} amount={spent} max={max} tone="bg-rose-500" />
          <div className={`rounded-2xl p-4 ${left >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
            <p className="text-lg font-medium text-ink">{t("home.left")}</p>
            <p className="font-display text-4xl font-semibold text-ink">{formatCurrency(left)}</p>
            <p className="mt-1 text-base text-graphite">{left >= 0 ? t("home.good") : t("home.careful")}</p>
          </div>
          <Button variant="outline" onClick={listen} className="h-auto gap-2 rounded-2xl py-3 text-lg">
            <Volume2 className="size-5" /> {t("home.listen")}
          </Button>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-4 rounded-3xl bg-sage p-6 text-center">
          <p className="text-lg text-ink">{t("home.empty")}</p>
          <Button asChild size="lg" className="h-auto gap-2 rounded-full bg-ink px-6 py-3 text-lg text-white">
            <Link href="/connect">
              <Link2 /> {t("home.connect")}
            </Link>
          </Button>
        </section>
      )}

      <button type="button" onClick={onFullView} className="self-center text-sm text-pewter underline">
        {t("dash.full_view")}
      </button>
    </div>
  );
}
