"use client";

import { useCallback } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Standalone, self-fetching net-worth history chart -- mirrors ForecastChart's
 * conventions (axis formatting, tooltip style, Ember line, no animation) so it
 * drops into dashboard/page.tsx in one line.
 */
export function NetWorthTrend({ userId, days = 180 }: { userId: string; days?: number }) {
  const fetchHistory = useCallback(() => api.netWorthHistory(userId, days), [userId, days]);
  const { data, error, loading, reload } = useAsync(fetchHistory, [userId, days]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net worth trend</CardTitle>
      </CardHeader>
      {loading && !data && <p className="text-sm text-pewter">Loading net worth history...</p>}
      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">Could not load net worth history: {error}</p>
          <button onClick={reload} className="self-start text-xs text-graphite underline">
            Retry
          </button>
        </div>
      )}
      {data && data.points.length === 0 && <p className="text-sm text-pewter">Not enough history yet.</p>}
      {data && data.points.length > 0 && (
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.points} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-fog)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatDate(d)}
                tick={{ fontSize: 11, fill: "var(--color-pewter)" }}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 11, fill: "var(--color-pewter)" }}
                width={80}
              />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(value) => [formatCurrency(Number(value)), "Net worth"]}
                contentStyle={{ borderRadius: 6, borderColor: "var(--color-mist)", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="net_worth"
                stroke="#5f7f0c"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
