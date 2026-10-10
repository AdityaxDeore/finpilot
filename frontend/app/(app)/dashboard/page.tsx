"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calculator, FileText, Link2, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync, useUserId } from "@/lib/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import {
  Card as LegacyCard,
  CardHeader as LegacyCardHeader,
  CardTitle as LegacyCardTitle,
} from "@/components/ui/Card";
import { Button as LegacyButton } from "@/components/ui/Button";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { RecurringList } from "@/components/dashboard/RecurringList";
import { DebtsList } from "@/components/dashboard/DebtsList";
import { AccountCards } from "@/components/dashboard/AccountCards";
import { NetWorthTrend } from "@/components/dashboard/NetWorthTrend";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { CashSummaryCard } from "@/components/dashboard/CashSummaryCard";
import { PromoCard } from "@/components/dashboard/PromoCard";
import { CategoryDonut, IncomeVsSpend, SpendingShifts, TopMerchants } from "@/components/dashboard/SpendCharts";
import { EvilHoverTraceBarChart } from "@/components/shadcn/hover-trace-bar-chart";
import { summarizeSpend } from "@/lib/spend";
import type { Transaction } from "@/lib/types";
import { AnswerContractView } from "@/components/AnswerContractView";
import {
  StatTileSkeleton,
  HealthScoreSkeleton,
  ForecastChartSkeleton,
  ListItemSkeleton,
} from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";

function Empty({ children }: { children: string }) {
  return <p className="py-10 text-center text-sm text-pewter">{children}</p>;
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Empty>{body}</Empty>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const userId = useUserId();
  const fetchDashboard = useCallback(() => api.dashboard(userId), [userId]);
  const { data, error, loading, reload } = useAsync(fetchDashboard, [userId]);
  // Pull recent transactions (200/page max) to power the charts and sparklines.
  const fetchTxns = useCallback(async () => {
    const all: Transaction[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await api.transactions(userId, { page, page_size: 200 });
      all.push(...res.items);
      if (all.length >= res.total) break;
    }
    return all;
  }, [userId]);
  const { data: txns } = useAsync(fetchTxns, [userId]);
  const spend = useMemo(() => summarizeSpend(txns ?? []), [txns]);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-60 rounded-card elevation-card p-6">
          <HealthScoreSkeleton />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LegacyCard key={i}>
              <StatTileSkeleton />
            </LegacyCard>
          ))}
        </div>
        <LegacyCard>
          <ForecastChartSkeleton />
        </LegacyCard>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LegacyCard>
            <ListItemSkeleton rows={3} />
          </LegacyCard>
          <LegacyCard>
            <ListItemSkeleton rows={2} />
          </LegacyCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <LegacyCard className="flex flex-col gap-4 border-rose-200 bg-rose-50/20 max-w-xl mx-auto my-12 text-center items-center py-8">
        <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg">
          !
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink">Could not load financial snapshot</h3>
          <p className="text-xs text-graphite mt-1 max-w-md">{error}</p>
          <p className="text-[11px] text-pewter mt-1">
            Ensure the backend server is running{process.env.NODE_ENV === "production" ? "." : ` on ${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}`}
          </p>
        </div>
        <LegacyButton variant="secondary" size="sm" onClick={reload} className="mt-2">
          Retry Fetching Snapshot
        </LegacyButton>
      </LegacyCard>
    );
  }

  if (!data) return null;

  const connected = data.has_data;
  const months = spend.months;
  const topCategory = spend.categories[0]?.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-4 pb-4 min-w-0 max-w-full"
    >
      {/* Top Banner: Financial Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.04]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-ink">
            Your money, at a glance
          </h1>
          <p className="text-xs sm:text-sm text-graphite mt-0.5">
            Where you stand, where it is going, and what to do next. Fully automatic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reload}>
            <RefreshCw />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tax">
              <Calculator className="text-ember" />
              Tax Optimizer
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/statement">
              <FileText />
              Export Statement
            </Link>
          </Button>
        </div>
      </div>

      {!connected && (
        <div className="relative overflow-hidden rounded-card bg-sage p-5 text-ink shadow-sm sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-lime/40 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/60">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold">Connect Google Pay to wake up your dashboard</h2>
                <p className="mt-0.5 max-w-xl text-sm text-ink/75">
                  One tap links your payments. FinPilot imports, categorises and analyses everything. Nothing to type in.
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="shrink-0 rounded-full bg-lime text-ink hover:bg-lime/85">
              <Link href="/connect">
                <Link2 /> Connect Google Pay
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Bento grid: three stretching columns, so every column ends on the same line while the cards inside differ in height */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4 [&>*]:flex-1 [&>*>*]:h-full">
          <div className="lg:flex-[3]">
            <RecentTransactions txns={txns ?? []} />
          </div>
          <div className="lg:flex-[2]">
            <CashSummaryCard
              netWorth={data.net_worth}
              income={data.monthly_income}
              expenses={data.monthly_expenses}
              savingsRate={data.savings_rate}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5 [&>*]:flex-1 [&>*>*]:h-full">
          <div className="lg:flex-[3]">
            <CategoryDonut summary={spend} />
          </div>
          <Card className="min-w-0 lg:flex-[2]">
            <CardHeader>
              <CardTitle className="font-display text-lg">Monthly spend</CardTitle>
              <CardDescription>Hover a bar to trace its value</CardDescription>
            </CardHeader>
            <CardContent className="h-56">
              {spend.months.length > 0 ? (
                <EvilHoverTraceBarChart
                  label="Spent"
                  data={spend.months.map((m) => ({ month: m.label, amount: Math.round(m.spend) }))}
                />
              ) : (
                <Empty>Monthly spending will chart here.</Empty>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-3 [&>*]:flex-1 [&>*>*]:h-full">
          <div>
          <KpiCard
            label="Money in"
            value={formatCurrency(data.monthly_income)}
            sub="per month"
            icon={TrendingUp}
            series={months.map((m) => m.income)}
          />
          </div>
          <div>
          <KpiCard
            label="Money out"
            value={formatCurrency(data.monthly_expenses)}
            sub="per month"
            icon={TrendingDown}
            variant="ink"
            series={months.map((m) => m.spend)}
          />
          </div>
          <div className="lg:flex-[1.3]">
            <PromoCard connected={connected} topCategory={topCategory} />
          </div>
        </div>
      </div>

      {connected ? (
        <HealthScoreCard score={data.health_score} />
      ) : (
        <Placeholder title="Financial health score" body="Your score, with the factors behind it, appears once an account is connected." />
      )}

      {/* Forecast / net worth */}
      <Card className="min-w-0">
        <Tabs defaultValue="forecast">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Outlook</CardTitle>
              <CardDescription>Bootstrap-resampled volatility bands and balance history</CardDescription>
            </div>
            <TabsList>
              <TabsTrigger value="forecast">90-day cash flow</TabsTrigger>
              <TabsTrigger value="networth">Net worth</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="min-w-0">
            <TabsContent value="forecast">
              {connected ? <ForecastChart forecast={data.forecast} /> : <Empty>Your 90-day cash-flow forecast will draw here.</Empty>}
            </TabsContent>
            <TabsContent value="networth">
              {connected ? <NetWorthTrend userId={userId} /> : <Empty>Net worth history will appear here.</Empty>}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Spending visuals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IncomeVsSpend summary={spend} />
        <TopMerchants summary={spend} />
      </div>
      <SpendingShifts summary={spend} />

      {/* Account Balances Cards */}
      <AccountCards userId={userId} />

      {/* Two-Column Grid: Recurring Commitments & Debts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecurringList obligations={data.recurring_obligations} />
        <DebtsList debts={data.debts} />
      </div>

      {/* Three-Lane Insights Panel */}
      <LegacyCard className="p-4 sm:p-5">
        <LegacyCardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ember text-ink font-bold text-xs shadow-sm">
              AI
            </div>
            <div>
              <LegacyCardTitle>Autonomous Financial Insights & Guidance</LegacyCardTitle>
              <p className="text-xs text-pewter mt-0.5">
                Observed facts, forward-looking predictions, and high-impact actions
              </p>
            </div>
          </div>
        </LegacyCardHeader>
        {connected ? (
          <AnswerContractView answer={data.insights} />
        ) : (
          <Empty>Insights and next-best actions show up once your data is connected.</Empty>
        )}
      </LegacyCard>
    </motion.div>
  );
}
