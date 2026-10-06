"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnswerContractView } from "@/components/AnswerContractView";
import { setUserId } from "@/lib/user";
import type { AnswerContract } from "@/lib/types";
import { FloatingOverlapCard } from "@/components/interactive/FloatingOverlapCard";
import { CashFlowChips } from "@/components/interactive/CashFlowChips";
import { InteractiveLineChart } from "@/components/interactive/InteractiveLineChart";
import { SankeyDiagram } from "@/components/interactive/SankeyDiagram";
import { GoalsCards } from "@/components/interactive/GoalsCards";
import { DeviceMockupSection } from "@/components/interactive/DeviceMockupSection";
import { InteractiveBentoGrid } from "@/components/interactive/InteractiveBentoGrid";
import { FeatureShowcase } from "@/components/showcase/FeatureShowcase";
import { SignInButton } from "@/components/SignInButton";
import { FinPilotLogo } from "@/components/FinPilotLogo";

const PREVIEW_ANSWER: AnswerContract = {
  query: "Can I afford to increase my SIP by ₹3,000/month?",
  narrative:
    "Yes, with room to spare -- your free cash flow comfortably covers the increase, and it meaningfully improves your 12-month trajectory.",
  facts: [
    { text: "Average monthly free cash flow over the last 90 days is ₹18,400.", value: null, source_txn_ids: [] },
    { text: "Current SIP contribution is ₹6,000/month across 2 funds.", value: null, source_txn_ids: [] },
  ],
  predictions: [
    {
      text: "Projected free cash flow next month, after fixed obligations",
      value: 17200,
      range_low: 14800,
      range_high: 19600,
      confidence: 0.81,
      basis: "90-day rolling average, adjusted for known upcoming bills",
    },
  ],
  recommendations: [
    {
      action: "increase_sip",
      text: "Increase SIP by ₹3,000/month",
      rationale: "Stays well within your observed cash-flow buffer even in a below-average month.",
      impact: { metric: "Net worth (5yr projected)", before: 842000, after: 1024000, delta: 182000, horizon: "5 years" },
      confidence: 0.78,
      action_params: {},
    },
  ],
  data_gaps: [],
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-ember-soft/40 via-transparent to-transparent pointer-events-none -z-10 blur-3xl" />

      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 py-4 sm:px-8 border-b border-black/[0.04]">
        <Link href="/" className="flex items-center gap-2">
          <FinPilotLogo variant="horizontal" size={28} showWordmark={true} />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xs sm:text-sm font-medium text-graphite hover:text-ink transition-colors">
            Dashboard
          </Link>
          <Link href="/copilot" className="text-xs sm:text-sm font-medium text-graphite hover:text-ink transition-colors">
            AI Copilot
          </Link>
          <SignInButton />
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto flex w-full max-w-[1240px] flex-col items-center text-center px-4 pt-12 pb-10 sm:px-8 sm:pt-20 sm:pb-16">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1 text-xs font-medium text-graphite shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md mb-6">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Fintech Intelligence Engine • 90-Day Cash-Flow Modeling</span>
        </div>

        {/* Editorial Headline */}
        <h1 className="font-display max-w-4xl text-4xl sm:text-6xl md:text-7xl leading-[1.08] text-ink tracking-tight">
          Your financial health, <br />
          <span className="italic font-normal text-ink">explained</span> — not just reported.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-base sm:text-xl text-graphite leading-relaxed">
          FinPilot reads your transactions, forecasts 90-day cash flow with P10/P90 confidence bands,
          and shows the simulated before → after impact of every financial recommendation.
        </p>

        {/* CTA Group */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/dashboard">
            <Button variant="primary" size="lg" className="px-7 py-3.5 text-base">
              Explore Live Demo
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </Link>
          <Link href="/simulate">
            <Button variant="secondary" size="lg" className="px-6 py-3.5 text-base">
              Run What-If Simulator
            </Button>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-pewter font-medium">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Zero signup required
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Offline rule router fallback
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Three-lane verified insights
          </span>
        </div>
      </section>

      {/* Feature Showcase (Interactive 3-Column Center Stage) */}
      <section className="w-full">
        <FeatureShowcase />
      </section>

      {/* COMPONENT 6: Device Mockup Section (Desktop + Phone) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8 border-t border-black/[0.06]">
        <DeviceMockupSection />
      </section>

      {/* COMPONENT 1: Floating Overlap Card Section (Reference 075432 / 075404) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <FloatingOverlapCard
          badge="Everyday Spend Intelligence"
          headline="Stay on top of your everyday spending."
          bodyText="Get an effortless breakdown of your finances to see where your money is going and how to improve. We notify you of important pace changes and balance alerts so you are never caught off guard."
          actionText="Track My Spending"
        />
      </section>

      {/* COMPONENT 5: Interactive Line Chart Section (Reference 075230) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <InteractiveLineChart
          title="Follow the Line: Real-Time Spending Velocity"
          subtitle="Start your day with a quick look at your spending curve, pending transactions, and budget margin. Scrub across points to inspect daily variance."
        />
      </section>

      {/* COMPONENT 3: Sankey Cash-Flow Section (References 075539 / 075603) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <SankeyDiagram />
      </section>

      {/* COMPONENT 4: Goals Cards Section (Reference 075552) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <GoalsCards />
      </section>

      {/* COMPONENT 2: Cash-Flow Floating Chips Section (Reference 075230) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <CashFlowChips
          title="Tactile Cash-Flow Streams"
          subtitle="Explore live inflows, fixed loan obligations, and investment channels. Hover to trigger magnetic repulsion, or drag any chip with spring return physics."
        />
      </section>

      {/* COMPONENT 7: Interactive Bento Grid Section */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-8 border-t border-black/[0.06]">
        <InteractiveBentoGrid />
      </section>

      {/* Three-Lane Integrity Live Component Preview */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-8 border-t border-black/[0.06]">
        <div className="max-w-xl mb-8">
          <span className="text-xs font-semibold text-ember uppercase tracking-wider">
            Verified Decision Engine
          </span>
          <h2 className="font-display text-2xl sm:text-3xl text-ink mt-1">
            Observed Facts, Predictions &amp; Recommendations
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-graphite">
            Every answer is decomposed into three distinct lanes. Zero blurred claims.
          </p>
        </div>
        <Card className="p-6 sm:p-8">
          <AnswerContractView answer={PREVIEW_ANSWER} />
        </Card>
      </section>

      {/* Feature Bento Grid (System Architecture) */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-8 border-t border-black/[0.06]">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl text-ink">
            Engineered for financial precision.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-graphite">
            Four specialized engines working in concert to consolidate, forecast, and optimize your wealth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Bento 1: 90-Day Forecast */}
          <Card hoverable className="flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-ember mb-4 border border-ember/20">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink">90-Day Cash-Flow Forecast</h3>
              <p className="mt-2 text-sm text-graphite leading-relaxed">
                P10/P50/P90 bootstrap-resampled trajectories. Detects upcoming deficit days weeks before they strike.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-black/[0.04] text-xs font-semibold text-ember">
              P10/P50/P90 Quantiles →
            </div>
          </Card>

          {/* Bento 2: Three-Lane Answer Contract */}
          <Card hoverable className="flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-indigo-600 mb-4 border border-indigo-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink">Three-Lane Integrity</h3>
              <p className="mt-2 text-sm text-graphite leading-relaxed">
                Every claim is strictly delineated: Observed facts, model Predictions, and actionable Recommendations.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-black/[0.04] text-xs font-semibold text-indigo-600">
              Zero Blurred Claims →
            </div>
          </Card>

          {/* Bento 3: What-If Simulation Engine */}
          <Card hoverable className="flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink">What-If Simulation</h3>
              <p className="mt-2 text-sm text-graphite leading-relaxed">
                Simulate 8 real financial decisions: prepay loans, cancel subscriptions, or boost SIPs with live before/after deltas.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-black/[0.04] text-xs font-semibold text-emerald-600">
              Live Before & After Diff →
            </div>
          </Card>

          {/* Bento 4: Privacy & Offline Mode */}
          <Card hoverable className="flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-4 border border-purple-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink">Complete Data Privacy</h3>
              <p className="mt-2 text-sm text-graphite leading-relaxed">
                Google Gemini function calling with a 100% offline rule-based router toggle. Your financial data stays local.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-black/[0.04] text-xs font-semibold text-purple-600">
              Offline Opt-Out Verified →
            </div>
          </Card>
        </div>
      </section>

      {/* Demo Personas Section */}
      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-8 border-t border-black/[0.06]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
          <div>
            <span className="text-xs font-semibold text-ember uppercase tracking-wider">
              Immediate Exploration
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-ink mt-1">
              Test drive on 3 curated personas.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-pewter mt-2 md:mt-0 max-w-md">
            Each persona is pre-loaded with 12 months of realistic transactions, distinct debt structures, and cash-flow characteristics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Persona 1: Priya */}
          <Card hoverable className="flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-full bg-orange-100 text-ember font-bold text-xs flex items-center justify-center">
                  P
                </span>
                <span className="text-xs font-semibold text-ember bg-orange-50 px-2.5 py-0.5 rounded-full">
                  High Debt APR
                </span>
              </div>
              <h4 className="text-lg font-semibold text-ink mt-3">Priya • Bengaluru</h4>
              <p className="text-xs text-graphite mt-1">
                ₹95,000/mo salary with ₹42,000 car loan + high APR credit card balance. Needs debt avalanche strategy.
              </p>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setUserId("demo-priya")}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-ember transition-colors"
            >
              Load Priya&apos;s Snapshot →
            </Link>
          </Card>

          {/* Persona 2: Arjun */}
          <Card hoverable className="flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                  A
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  Strong Savings
                </span>
              </div>
              <h4 className="text-lg font-semibold text-ink mt-3">Arjun • Mumbai</h4>
              <p className="text-xs text-graphite mt-1">
                ₹160,000/mo salary with home loan EMI and twin education obligations. Strong emergency fund.
              </p>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setUserId("demo-arjun")}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-ember transition-colors"
            >
              Load Arjun&apos;s Snapshot →
            </Link>
          </Card>

          {/* Persona 3: Meera */}
          <Card hoverable className="flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                  M
                </span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Tight Cash Flow
                </span>
              </div>
              <h4 className="text-lg font-semibold text-ink mt-3">Meera • Pune</h4>
              <p className="text-xs text-graphite mt-1">
                ₹42,000/mo salary with shared rent and student loan. Thin margin for unexpected cash shocks.
              </p>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setUserId("demo-meera")}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-ember transition-colors"
            >
              Load Meera&apos;s Snapshot →
            </Link>
          </Card>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-8">
        <div className="rounded-card border border-ink/10 bg-ink text-white p-8 sm:p-12 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          <div className="absolute right-0 bottom-0 w-96 h-96 bg-ember/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-xl">
            <span className="text-xs font-semibold text-ember uppercase tracking-wider">
              No Installation Needed
            </span>
            <h2 className="font-display text-3xl sm:text-4xl text-white mt-2">
              Ready to see FinPilot in action?
            </h2>
            <p className="mt-3 text-sm text-mist leading-relaxed">
              Explore real-time health scoring, 90-day cash-flow forecasting, and simulated impact recommendations now.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/dashboard">
                <Button variant="primary" size="lg" className="px-7 py-3 text-base">
                  Launch Dashboard
                </Button>
              </Link>
              <Link href="/copilot">
                <Button variant="secondary" size="lg" className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-base">
                  Ask FinPilot Copilot
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
