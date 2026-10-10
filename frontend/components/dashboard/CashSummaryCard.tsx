import { formatCurrency, formatPercent } from "@/lib/format";

/** Lime summary card, laid out like a bank card: balance on top, details underneath. */
export function CashSummaryCard({
  netWorth,
  income,
  expenses,
  savingsRate,
}: {
  netWorth: number;
  income: number;
  expenses: number;
  savingsRate: number;
}) {
  const rows: [string, string][] = [
    ["Money in / month", formatCurrency(income)],
    ["Money out / month", formatCurrency(expenses)],
    ["Savings rate", formatPercent(savingsRate)],
  ];
  return (
    <div className="flex h-full flex-col gap-4 rounded-card bg-white p-4 shadow-sm">
      <div className="rounded-3xl bg-lime p-5 text-ink">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink/60">
          <span>Net worth</span>
          <span className="flex">
            <i className="size-5 rounded-full bg-lime-dark" />
            <i className="-ml-2 size-5 rounded-full bg-lime-dark/40" />
          </span>
        </div>
        <p className="mt-3 font-display text-4xl font-semibold tnum">{formatCurrency(netWorth)}</p>
        <p className="mt-1 text-xs text-ink/60">Liquid + invested</p>
      </div>
      <dl className="grid gap-2 px-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-graphite">{k}</dt>
            <dd className="font-semibold tnum text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
