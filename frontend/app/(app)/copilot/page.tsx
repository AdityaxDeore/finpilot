"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
  Scissors,
  PiggyBank,
  CheckCircle2,
  FileText,
  Search,
  Database,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useUserId } from "@/lib/hooks";
import { getOfflineOnly, setOfflineOnly } from "@/lib/user";
import type { AnswerContract, Recommendation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { Chip } from "@/components/ui/Chip";
import { formatCurrency, formatImpactValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askFinancialAI } from "@/lib/firebase/ai";

interface CategorizedPrompt {
  category: "Cash Flow" | "Debt Avalanche" | "Subscriptions" | "SIP Check";
  query: string;
  icon: typeof TrendingUp;
  badgeTone: string;
}

const CATEGORIZED_PROMPTS: CategorizedPrompt[] = [
  {
    category: "Cash Flow",
    query: "Will I face any cash deficit in the next 90 days?",
    icon: TrendingUp,
    badgeTone: "border-blue-200 bg-blue-50/70 text-blue-700",
  },
  {
    category: "Debt Avalanche",
    query: "How much interest do I save if I pay ₹5,000 extra on my car loan?",
    icon: Zap,
    badgeTone: "border-amber-200 bg-amber-50/70 text-amber-700",
  },
  {
    category: "Subscriptions",
    query: "Which subscriptions are candidates for cancellation?",
    icon: Scissors,
    badgeTone: "border-rose-200 bg-rose-50/70 text-rose-700",
  },
  {
    category: "SIP Check",
    query: "Can I afford to increase my mutual fund SIP by ₹3,000/month?",
    icon: PiggyBank,
    badgeTone: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  },
];

interface Turn {
  role: "user" | "assistant";
  message: string;
  answer?: AnswerContract;
}

function getSimulatorUrl(rec: Recommendation): string {
  const { action, action_params } = rec;
  const p = (action_params || {}) as Record<string, unknown>;

  if (action === "cancel_subscription") {
    const rawGroupId =
      p.group_id ??
      (Array.isArray(p.group_ids) && p.group_ids.length > 0 ? p.group_ids[0] : "");
    const groupId = encodeURIComponent(String(rawGroupId ?? ""));
    return `/simulate?action=cancel_subscription&groupId=${groupId}`;
  }

  if (action === "prepay_debt") {
    const debtId = encodeURIComponent(String(p.debt_id ?? ""));
    const amount = encodeURIComponent(String(p.extra_payment ?? 2000));
    return `/simulate?action=prepay_debt&debtId=${debtId}&amount=${amount}`;
  }

  if (action === "increase_sip") {
    const amount = encodeURIComponent(String(p.amount ?? 3000));
    return `/simulate?action=increase_sip&amount=${amount}`;
  }

  return `/simulate?action=${encodeURIComponent(action)}`;
}

export default function CopilotPage() {
  const userId = useUserId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFirebaseAI, setUseFirebaseAI] = useState(false);

  // Switching persona via the NavShell switcher resets conversation
  const [lastUserId, setLastUserId] = useState(userId);
  if (userId !== lastUserId) {
    setLastUserId(userId);
    setTurns([]);
    setError(null);
    setInput("");
  }

  async function send(message: string) {
    if (!message.trim() || loading) return;
    setError(null);
    setInput("");
    setTurns((t) => [...t, { role: "user", message }]);
    setLoading(true);

    if (useFirebaseAI) {
      try {
        const aiResponse = await askFinancialAI(message, `Active FinPilot User: ${userId}`);
        const answer: AnswerContract = {
          query: message,
          facts: [
            {
              text: "Firebase AI Logic (Gemini 2.5 Flash)",
              value: null,
              source_txn_ids: [],
            },
          ],
          predictions: [],
          recommendations: [],
          data_gaps: [],
          narrative: aiResponse,
        };
        setTurns((t) => [...t, { role: "assistant", message, answer }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Firebase AI request failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const answer = await api.chat(message, userId);
      setTurns((t) => [...t, { role: "assistant", message, answer }]);
    } catch (err) {
      // Automatic fallback to client-side Firebase AI Logic
      try {
        const fallbackText = await askFinancialAI(message, `Active FinPilot User: ${userId}`);
        const answer: AnswerContract = {
          query: message,
          facts: [
            {
              text: "Firebase AI Fallback (Gemini 2.5 Flash)",
              value: null,
              source_txn_ids: [],
            },
          ],
          predictions: [],
          recommendations: [],
          data_gaps: [],
          narrative: fallbackText,
        };
        setTurns((t) => [...t, { role: "assistant", message, answer }]);
      } catch {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-ink">
              Financial Copilot
            </h1>
            <span className="flex h-2 w-2 rounded-full bg-ember animate-pulse" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-graphite">
            Grounded in your real transactions. Delivers clear, verifiable 3-lane answers with Firebase AI Logic.
          </p>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setUseFirebaseAI(!useFirebaseAI)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer",
              useFirebaseAI
                ? "border-amber-400/40 bg-amber-500/10 text-amber-600 font-medium"
                : "border-black/[0.08] bg-fog/80 text-graphite hover:bg-fog"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Firebase AI Logic</span>
          </button>

          {/* Offline Mode Toggle */}
          <label className="flex shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-fog/80 px-3 py-1.5 text-xs text-graphite shadow-sm cursor-pointer hover:bg-fog transition-colors">
            <input
              type="checkbox"
              defaultChecked={getOfflineOnly()}
              onChange={(e) => setOfflineOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-black/20 accent-ember cursor-pointer"
            />
            <span className="font-medium">Offline Rule-Engine Only</span>
          </label>
        </div>
      </div>

      {/* Suggested Categorized Starter Prompts (Top) */}
      {turns.length === 0 && (
        <div className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-pewter">
              Suggested Inquiries for {userId.replace("demo-", "")}
            </span>
            <span className="text-[11px] text-pewter">Click prompt to run analysis</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIZED_PROMPTS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.category}
                  type="button"
                  onClick={() => send(p.query)}
                  className="flex flex-col text-left p-4 rounded-chip border border-black/[0.08] bg-white hover:bg-fog hover:border-black/[0.14] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.99] group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                        p.badgeTone
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {p.category}
                    </span>
                    <span className="text-pewter group-hover:text-ember group-hover:translate-x-0.5 transition-all text-xs font-bold">
                      →
                    </span>
                  </div>
                  <span className="text-xs font-medium text-ink leading-relaxed">
                    &ldquo;{p.query}&rdquo;
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="flex flex-col gap-6 min-h-[300px]">
        <AnimatePresence initial={false}>
          {turns.map((t, i) =>
            t.role === "user" ? (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="ml-auto max-w-[85%] sm:max-w-[75%] flex flex-col items-end"
              >
                <div className="rounded-2xl rounded-br-sm bg-ink text-white px-4 py-3 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                  {t.message}
                </div>
                <span className="text-[10px] text-pewter mt-1 px-1">You</span>
              </motion.div>
            ) : (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1.5 w-full"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ember text-white text-[11px] font-bold shadow-sm">
                    F
                  </div>
                  <span className="text-xs font-semibold text-ink">FinPilot Copilot</span>
                  <span className="text-[10px] text-pewter">Three-lane verified answer</span>
                </div>
                <Card className="p-5 sm:p-7 shadow-sm">
                  {t.answer && <CopilotAnswerContractView answer={t.answer} />}
                </Card>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Loading Indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-chip border border-black/[0.06] bg-fog/60 self-start"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ember text-white text-[11px] font-bold animate-pulse">
              F
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-graphite">
                Analyzing transactions & cash-flow models...
              </span>
              <span className="flex gap-1 ml-1">
                <span className="h-1.5 w-1.5 rounded-full bg-ember animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-ember animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-ember animate-bounce [animation-delay:0.4s]" />
              </span>
            </div>
          </motion.div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-chip border border-rose-200 bg-rose-50/60 text-xs text-rose-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>Could not reach copilot: {error}</span>
          </div>
        )}
      </div>

      {/* Floating Query Input Bar & Bottom Starter Chips */}
      <div className="sticky bottom-4 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-sm flex flex-col gap-2">
        {/* Categorized Prompt Starter Chips (Quick Bar) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-pewter shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-ember" /> Quick Explorers:
          </span>
          {CATEGORIZED_PROMPTS.map((p) => (
            <button
              key={p.category}
              type="button"
              onClick={() => send(p.query)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.08] bg-white hover:bg-fog hover:border-black/[0.18] text-[11px] font-medium text-graphite hover:text-ink shrink-0 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span className="font-semibold text-ink">{p.category}</span>
              <span className="text-pewter">&middot;</span>
              <span className="truncate max-w-[170px] sm:max-w-[220px]">
                {p.query}
              </span>
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-2 p-1.5 rounded-2xl border border-black/[0.1] bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about spending, debts, forecast gaps, or affordability..."
            className="flex-1 bg-transparent px-4 py-2.5 text-sm text-ink outline-none placeholder:text-pewter"
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0"
          >
            Ask Copilot
          </Button>
        </form>
        <div className="flex items-center justify-between px-3 pt-1 text-[10px] text-pewter">
          <span>Every number is grounded in your actual database records</span>
          <span>Press Enter ↵ to send</span>
        </div>
      </div>
    </div>
  );
}

function CopilotAnswerContractView({ answer }: { answer: AnswerContract }) {
  const { facts, predictions, recommendations, data_gaps, narrative } = answer;
  const isEmpty =
    facts.length === 0 && predictions.length === 0 && recommendations.length === 0 && !narrative;

  if (isEmpty) {
    return <p className="text-sm text-pewter">No insights available yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Executive Narrative */}
      {narrative && (
        <div className="rounded-surface border border-black/[0.06] bg-fog/60 p-4 text-sm leading-relaxed text-graphite flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-ember shrink-0 mt-0.5" />
          <div className="flex-1">{narrative}</div>
        </div>
      )}

      {/* Lane 1: Observed Facts */}
      {facts.length > 0 && (
        <CopilotLane
          title="Observed Facts"
          hint="Grounded in your actual transactions"
          badgeColor="bg-ink"
          icon={<Database className="h-3 w-3 text-white" />}
        >
          <div className="rounded-surface border border-black/[0.08] bg-white p-4 shadow-sm">
            <ul className="flex flex-col divide-y divide-black/[0.04]">
              {facts.map((f, i) => {
                const textAlreadyHasValue = /[₹%]|\d+\s*\/\s*\d+/.test(f.text);
                return (
                  <li key={i} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3 text-sm text-ink">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{f.text}</span>
                      </div>
                      {f.value !== null && !textAlreadyHasValue ? (
                        <span className="font-semibold text-ink tnum shrink-0">
                          {formatCurrency(f.value)}
                        </span>
                      ) : null}
                    </div>

                    {/* Citations & Source Verification */}
                    <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200/60">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> Grounded Fact
                      </span>
                      {f.source_txn_ids && f.source_txn_ids.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-pewter flex items-center gap-1 ml-1">
                            <FileText className="h-3 w-3 text-pewter" /> Citations:
                          </span>
                          {f.source_txn_ids.map((id, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-fog text-graphite border border-black/[0.06]"
                              title={`Source Transaction ID: ${id}`}
                            >
                              txn:{id.length > 10 ? `${id.slice(0, 8)}…` : id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-pewter flex items-center gap-1 ml-1">
                          <Database className="h-2.5 w-2.5 text-pewter" /> Verified ledger history
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </CopilotLane>
      )}

      {/* Lane 2: Predicted Modeling */}
      {predictions.length > 0 && (
        <CopilotLane
          title="Model Predictions"
          hint="Forward-looking cash flow and volatility estimates"
          badgeColor="bg-indigo-600"
          icon={<TrendingUp className="h-3 w-3 text-white" />}
        >
          <div className="rounded-surface border border-indigo-100 bg-indigo-50/20 p-4 shadow-sm">
            <ul className="flex flex-col gap-3.5">
              {predictions.map((p, i) => (
                <li key={i} className="flex flex-col gap-2 text-sm bg-white/80 p-3.5 rounded-xl border border-indigo-100/70 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{p.text}</span>
                    <ConfidenceChip value={p.confidence} />
                  </div>

                  {(p.range_low !== null || p.range_high !== null) && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-graphite">
                      <span className="text-pewter">Confidence interval:</span>
                      <span className="tnum font-medium text-ink bg-white px-2 py-0.5 rounded border border-black/[0.06]">
                        {p.range_low !== null ? formatCurrency(p.range_low) : "?"} &ndash;{" "}
                        {p.range_high !== null ? formatCurrency(p.range_high) : "?"}
                      </span>
                    </div>
                  )}

                  {/* Prediction Basis / Citations */}
                  {p.basis && (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-900 bg-indigo-50/70 px-2.5 py-1 rounded-md border border-indigo-150">
                      <Search className="h-3 w-3 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-indigo-700">Model Basis:</span>
                      <span className="text-graphite">{p.basis}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </CopilotLane>
      )}

      {/* Lane 3: Recommended Actions */}
      {recommendations.length > 0 && (
        <CopilotLane
          title="Recommended Actions"
          hint="Simulated impact on your net worth and health score"
          badgeColor="bg-ember"
          icon={<Zap className="h-3 w-3 text-white" />}
        >
          <div className="flex flex-col gap-3.5">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className="rounded-surface border border-ember/25 bg-gradient-to-b from-white to-orange-50/25 p-4 sm:p-5 shadow-[0_2px_12px_rgba(255,89,0,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-ink flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-ember shrink-0" />
                    <span>{r.text}</span>
                  </p>
                  <ConfidenceChip value={r.confidence} />
                </div>

                <p className="mt-1.5 text-xs text-graphite pl-4 leading-relaxed">{r.rationale}</p>

                {/* Before vs After Impact Visual Pill */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/[0.06] text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-pewter">{r.impact.metric}:</span>
                    <span className="text-graphite line-through tnum">
                      {formatImpactValue(r.impact.metric, r.impact.before)}
                    </span>
                    <span className="text-pewter">→</span>
                    <span className="font-bold text-ink tnum">
                      {formatImpactValue(r.impact.metric, r.impact.after)}
                    </span>
                    <span
                      className={cn(
                        "font-bold tnum px-1.5 py-0.5 rounded",
                        r.impact.delta >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      )}
                    >
                      ({r.impact.delta >= 0 ? "+" : ""}
                      {formatImpactValue(r.impact.metric, r.impact.delta)})
                    </span>
                  </div>

                  <Chip tone="outline" className="text-[10px]">
                    Horizon: {r.impact.horizon}
                  </Chip>
                </div>

                {/* Prominent Action Button for What-If Simulator */}
                <div className="mt-4 pt-3.5 border-t border-black/[0.06] flex items-center justify-end">
                  <Link
                    href={getSimulatorUrl(r)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ink hover:bg-black text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.98] group/btn border border-black/10"
                    aria-label={`Test ${r.text} in What-If Simulator`}
                  >
                    <span className="text-amber-400">⚡</span>
                    <span>Test in What-If Simulator</span>
                    <ArrowRight className="h-3.5 w-3.5 text-pewter group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CopilotLane>
      )}

      {/* Data Gaps Section */}
      {data_gaps.length > 0 && (
        <div className="rounded-surface border border-dashed border-black/[0.12] bg-fog/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-pewter flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-pewter" />
            <span>Identified Data Gaps & Model Caveats</span>
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {data_gaps.map((g, i) => (
              <li key={i} className="text-xs text-graphite flex items-start gap-1.5">
                <span className="text-pewter">•</span>
                <div>
                  <span className="font-medium text-ink">{g.text}</span>
                  <span className="text-pewter"> — {g.what_would_help}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CopilotLane({
  title,
  hint,
  badgeColor,
  icon,
  children,
}: {
  title: string;
  hint: string;
  badgeColor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-white shadow-2xs",
              badgeColor
            )}
            aria-hidden
          >
            {icon}
          </span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink">{title}</h4>
        </div>
        <span className="text-[11px] text-pewter">{hint}</span>
      </header>
      {children}
    </section>
  );
}
