import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { CATEGORY_META } from "@/lib/spend";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";

/** Latest transactions as a compact list with coloured merchant avatars. */
export function RecentTransactions({ txns }: { txns: Transaction[] }) {
  const recent = [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return (
    <Card className="h-full min-w-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Recent transactions</CardTitle>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/transactions">
            View all <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-pewter">Transactions appear here once Google Pay is connected.</p>
        ) : (
          <ul className="grid gap-3">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold text-white"
                  style={{ background: CATEGORY_META[t.category].color }}
                >
                  {t.merchant.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{t.merchant}</p>
                  <p className="text-xs text-pewter">{formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold tnum ${t.amount > 0 ? "text-leaf" : "text-ink"}`}>
                  {t.amount > 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
