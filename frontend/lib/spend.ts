import type { Transaction, TxnCategory } from "@/lib/types";

/** Categories that move money between the user's own accounts, not real spend/income. */
const NON_SPEND: TxnCategory[] = ["transfer", "credit_card_payment", "income"];

export const CATEGORY_META: Record<TxnCategory, { label: string; color: string }> = {
  income: { label: "Income", color: "#12a56b" },
  rent_housing: { label: "Rent & housing", color: "#14213d" },
  emi_loan: { label: "EMI & loans", color: "#e5484d" },
  groceries: { label: "Groceries", color: "#12a56b" },
  dining: { label: "Dining", color: "#ff7a2f" },
  transport: { label: "Transport", color: "#2f7cf6" },
  utilities: { label: "Utilities", color: "#12a5b8" },
  subscriptions: { label: "Subscriptions", color: "#8b5cf6" },
  shopping: { label: "Shopping", color: "#f0647e" },
  healthcare: { label: "Healthcare", color: "#5cc98b" },
  entertainment: { label: "Entertainment", color: "#ffc24b" },
  investment_sip: { label: "Investments", color: "#0e7490" },
  credit_card_payment: { label: "Card payments", color: "#a7a9b4" },
  transfer: { label: "Transfers", color: "#a7a9b4" },
  fees_interest: { label: "Fees & interest", color: "#c2410c" },
  other: { label: "Other", color: "#c9bfa8" },
};

export interface MonthTotals {
  month: string; // YYYY-MM
  label: string; // "Mar"
  income: number;
  spend: number;
  savings: number;
}

export interface CategoryTotal {
  category: TxnCategory;
  label: string;
  color: string;
  total: number;
  prev: number;
  /** % change vs previous month; null when there was no spend before. */
  change: number | null;
}

export interface MerchantTotal {
  merchant: string;
  total: number;
  count: number;
}

export interface SpendSummary {
  months: MonthTotals[];
  latestMonth: string | null;
  categories: CategoryTotal[];
  merchants: MerchantTotal[];
  totalSpend: number;
}

const MONTH_FMT = new Intl.DateTimeFormat("en", { month: "short" });

function monthLabel(month: string): string {
  return MONTH_FMT.format(new Date(`${month}-01T00:00:00`));
}

/** Aggregates raw transactions into monthly, category and merchant totals. Positive amount = inflow. */
export function summarizeSpend(txns: Transaction[], monthsBack = 6): SpendSummary {
  const byMonth = new Map<string, { income: number; spend: number }>();
  for (const t of txns) {
    const key = t.date.slice(0, 7);
    const m = byMonth.get(key) ?? { income: 0, spend: 0 };
    if (t.amount > 0 && t.category === "income") m.income += t.amount;
    else if (t.amount < 0 && !NON_SPEND.includes(t.category)) m.spend += -t.amount;
    byMonth.set(key, m);
  }

  const keys = [...byMonth.keys()].sort().slice(-monthsBack);
  const months: MonthTotals[] = keys.map((month) => {
    const m = byMonth.get(month)!;
    return { month, label: monthLabel(month), income: m.income, spend: m.spend, savings: m.income - m.spend };
  });

  const latestMonth = keys.at(-1) ?? null;
  const prevMonth = keys.at(-2) ?? null;

  const cat = new Map<TxnCategory, { total: number; prev: number }>();
  const merch = new Map<string, MerchantTotal>();
  for (const t of txns) {
    if (t.amount >= 0 || NON_SPEND.includes(t.category)) continue;
    const key = t.date.slice(0, 7);
    const c = cat.get(t.category) ?? { total: 0, prev: 0 };
    if (key === latestMonth) {
      c.total += -t.amount;
      const mm = merch.get(t.merchant) ?? { merchant: t.merchant, total: 0, count: 0 };
      mm.total += -t.amount;
      mm.count += 1;
      merch.set(t.merchant, mm);
    } else if (key === prevMonth) c.prev += -t.amount;
    cat.set(t.category, c);
  }

  const categories: CategoryTotal[] = [...cat.entries()]
    .filter(([, v]) => v.total > 0 || v.prev > 0)
    .map(([category, v]) => ({
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      total: v.total,
      prev: v.prev,
      change: v.prev > 0 ? ((v.total - v.prev) / v.prev) * 100 : null,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    months,
    latestMonth,
    categories,
    merchants: [...merch.values()].sort((a, b) => b.total - a.total).slice(0, 6),
    totalSpend: categories.reduce((n, c) => n + c.total, 0),
  };
}
