"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calculator, FileText, Plus, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync, useUserId } from "@/lib/hooks";
import { isDemoUserId } from "@/lib/user";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddDataPanel } from "@/components/dashboard/AddDataPanel";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { RecurringList } from "@/components/dashboard/RecurringList";
import { DebtsList } from "@/components/dashboard/DebtsList";
import { AccountCards } from "@/components/dashboard/AccountCards";
import { NetWorthTrend } from "@/components/dashboard/NetWorthTrend";
import { AnswerContractView } from "@/components/AnswerContractView";
import {
  StatTileSkeleton,
  HealthScoreSkeleton,
  ForecastChartSkeleton,
  ListItemSkeleton,
} from "@/components/ui/Skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function DashboardPage() {
  const userId = useUserId();
  const fetchDashboard = useCallback(() => api.dashboard(userId), [userId]);
  const { data, error, loading, reload } = useAsync(fetchDashboard, [userId]);
  const [showAdd, setShowAdd] = useState(false);
  const isDemo = isDemoUserId(userId);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-60 rounded-card elevation-card p-6">
          <HealthScoreSkeleton />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <StatTileSkeleton />
            </Card>
          ))}
        </div>
        <Card>
          <ForecastChartSkeleton />
        </Card>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <Card>
            <ListItemSkeleton rows={3} />
          </Card>
          <Card>
            <ListItemSkeleton rows={2} />
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col gap-4 border-rose-200 bg-rose-50/20 max-w-xl mx-auto my-12 text-center items-center py-8">
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
        <Button variant="secondary" size="sm" onClick={reload} className="mt-2">
          Retry Fetching Snapshot
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  // Real signed-in user who hasn't added anything yet: never show demo data,
  // just walk them through adding their own.
  if (!data.has_data) {
    return (
      <div className="flex flex-col gap-6 pb-12 max-w-3xl mx-auto w-full">
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="Welcome to FinPilot — let's set up your finances"
          body="Nothing here is demo data. Add an account, log a transaction, or import a bank statement and your dashboard, forecast and insights will build from your own numbers."
        />
        <Card className="p-4 sm:p-5">
          <CardHeader>
            <CardTitle>Add your first data</CardTitle>
          </CardHeader>
          <AddDataPanel userId={userId} />
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5 pb-4 min-w-0 max-w-full"
    >
      {/* Top Banner: Financial Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.04]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-ink">
            Financial Health Command Center
          </h1>
          <p className="text-xs sm:text-sm text-graphite mt-0.5">
            Consolidated accounts, debt pressure, and 90-day cash-flow simulation for{" "}
            <span className="font-semibold text-ink capitalize">
              {isDemo ? userId.replace("demo-", "") : "your accounts"}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isDemo && (
            <Button variant="secondary" size="sm" onClick={() => setShowAdd((v) => !v)} className="text-xs font-semibold gap-1.5">
              <Plus className="w-3.5 h-3.5 text-ember" />
              <span>{showAdd ? "Close" : "Add data"}</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={reload} className="text-xs">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </Button>

          <Link href="/tax">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold gap-1.5 shadow-xs border-mist hover:border-black/20"
            >
              <Calculator className="w-3.5 h-3.5 text-ember" />
              <span>Tax Optimizer</span>
            </Button>
          </Link>

          <Link href="/statement">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold gap-1.5 shadow-xs border-mist hover:border-black/20"
            >
              <FileText className="w-3.5 h-3.5 text-ember" />
              <span>Export Financial Statement</span>
            </Button>
          </Link>
        </div>
      </div>

      {!isDemo && showAdd && (
        <Card className="p-4 sm:p-5">
          <CardHeader>
            <CardTitle>Add data</CardTitle>
          </CardHeader>
          <AddDataPanel userId={userId} />
        </Card>
      )}

      {/* Primary Bento Hero: Health Score Card */}
      <HealthScoreCard score={data.health_score} />

      {/* KPI Stat Tiles Bento Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card hoverable className="p-4">
          <StatTile
            label="Net Worth"
            value={formatCurrency(data.net_worth)}
            sub="Liquid + Invested Assets"
          />
        </Card>
        <Card hoverable className="p-4">
          <StatTile
            label="Monthly Inflow"
            value={formatCurrency(data.monthly_income)}
            trend={{ direction: "up", text: "Stable", positive: true }}
            sub="Verified Payroll"
          />
        </Card>
        <Card hoverable className="p-4">
          <StatTile
            label="Monthly Outflow"
            value={formatCurrency(data.monthly_expenses)}
            sub="Obligations & Living"
          />
        </Card>
        <Card hoverable className="p-4">
          <StatTile
            label="Savings Rate"
            value={formatPercent(data.savings_rate)}
            trend={{
              direction: data.savings_rate >= 0.2 ? "up" : "down",
              text: data.savings_rate >= 0.2 ? "Target Met" : "Below 20%",
              positive: data.savings_rate >= 0.2,
            }}
            sub="Post-tax surplus"
          />
        </Card>
      </div>

      {/* Cash-Flow Forecast Section */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 min-w-0">
      <Card className="p-4 sm:p-5 min-w-0">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>90-Day Cash-Flow Trajectory</CardTitle>
            <span className="text-xs text-pewter font-normal hidden sm:inline">
              (Bootstrap-resampled volatility bands)
            </span>
          </div>
        </CardHeader>
        <ForecastChart forecast={data.forecast} />
      </Card>

      {/* Net Worth Trend Section */}
      <Card className="p-4 sm:p-5 min-w-0">
        <CardHeader>
          <CardTitle>Net Worth Over Time</CardTitle>
        </CardHeader>
        <NetWorthTrend userId={userId} />
      </Card>
      </div>

      {/* Account Balances Cards */}
      <AccountCards userId={userId} />

      {/* Two-Column Grid: Recurring Commitments & Debts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
        <RecurringList obligations={data.recurring_obligations} />
        <DebtsList debts={data.debts} />
      </div>

      {/* Three-Lane Insights Panel */}
      <Card className="p-4 sm:p-5">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ember text-white font-bold text-xs shadow-sm">
              AI
            </div>
            <div>
              <CardTitle>Autonomous Financial Insights & Guidance</CardTitle>
              <p className="text-xs text-pewter mt-0.5">
                Observed facts, forward-looking predictions, and high-impact actions
              </p>
            </div>
          </div>
        </CardHeader>
        <AnswerContractView answer={data.insights} />
      </Card>
    </motion.div>
  );
}
