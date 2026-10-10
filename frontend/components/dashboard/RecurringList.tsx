import type { RecurringObligation } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { formatCurrency, formatDate } from "@/lib/format";

function getMerchantIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("netflix") || n.includes("prime") || n.includes("spotify")) return "▶";
  if (n.includes("rent") || n.includes("housing") || n.includes("pg")) return "⌂";
  if (n.includes("gym") || n.includes("fitness")) return "✦";
  if (n.includes("insurance") || n.includes("lic")) return "🛡";
  if (n.includes("wifi") || n.includes("broadband") || n.includes("phone") || n.includes("airtel")) return "📶";
  if (n.includes("emi") || n.includes("loan")) return "⚡";
  return "•";
}

export function RecurringList({ obligations }: { obligations: RecurringObligation[] }) {
  const totalMonthly = obligations.reduce((acc, o) => acc + Math.abs(o.amount), 0);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Recurring Obligations</CardTitle>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-fog border border-black/[0.06] text-graphite">
              {obligations.length} Active
            </span>
          </div>
          <span className="text-xs font-semibold text-ink tnum">
            {formatCurrency(totalMonthly)}/mo
          </span>
        </CardHeader>

        {obligations.length === 0 ? (
          <div className="py-8 text-center text-sm text-pewter">
            No recurring commitments detected.
          </div>
        ) : (
          <ul className="flex max-h-80 flex-col divide-y divide-black/[0.04] overflow-y-auto pr-1">
            {obligations.map((o) => (
              <li
                key={o.group_id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-fog/40 px-1 rounded-chip transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fog border border-black/[0.06] text-ink font-semibold text-xs shrink-0">
                    {getMerchantIcon(o.merchant)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink leading-snug">{o.merchant}</p>
                    <p className="text-[11px] text-pewter">
                      Due: {formatDate(o.next_expected_date)} &middot;{" "}
                      <span className="capitalize">{o.frequency}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-fog text-graphite uppercase tracking-wider">
                    {o.category.replace(/_/g, " ")}
                  </span>
                  <ConfidenceChip value={o.confidence} />
                  <span className="text-right text-sm font-bold text-ink tnum min-w-[70px]">
                    {formatCurrency(Math.abs(o.amount))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-black/[0.04] text-[11px] text-pewter flex items-center justify-between">
        <span>Recurring subscriptions & bills auto-detected</span>
        <span className="text-ember font-medium">Synced with transactions</span>
      </div>
    </Card>
  );
}
