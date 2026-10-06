import type {
  Account,
  AnswerContract,
  Budget,
  BudgetStatus,
  CategorizationRule,
  CategorizationRuleCreate,
  CategorizationRuleList,
  CreateAccountRequest,
  CreateBudgetRequest,
  CreateGoalRequest,
  CreateHouseholdRequest,
  CreateInviteRequest,
  DashboardSnapshot,
  Goal,
  GoalProgress,
  Household,
  HouseholdInvite,
  HouseholdSummary,

  NetWorthHistory,
  NotificationItem,
  RecomputeDiff,
  ReviewQueueResponse,
  ReviewTransactionRequest,
  SafeToSpend,
  SimulationRequest,
  SimulationResult,
  TaxCalculationRequest,
  TaxOptimizationAnalysis,
  Transaction,
  TransactionFilters,
  TransactionPage,
  TransactionUpdate,
  UpdateBudgetRequest,
  UpdateGoalRequest,
} from "./types";
import { createClient } from "./supabase/client";
import { DATA_CHANGED_EVENT } from "./hooks";
import { getOfflineOnly } from "./user";

// Production (Vercel multi-service project) serves the backend on the same
// origin under /api, so default to relative URLs there; local dev talks to
// the separate uvicorn server. NEXT_PUBLIC_API_URL overrides either.
// Dev uses 127.0.0.1, not "localhost": uvicorn binds IPv4 only, and clients
// that try IPv6 (::1) first wait ~2s per request before falling back.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000");

const AUTH_HEADER_TIMEOUT_MS = 2000;

/** The backend now verifies a real Supabase session token for any user_id
 * that isn't one of the fixed demo personas (see backend/app/core/auth.py)
 * -- attach it whenever one exists. Demo-only usage (no signed-in session)
 * simply omits the header, which the backend already allows for the demo
 * personas.
 *
 * This runs before EVERY API call, including plain demo-mode traffic that
 * needs no auth at all -- so it must never be allowed to hang. supabase-js's
 * getSession() can stall indefinitely in some environments (unreachable
 * auth endpoint, a blocked/slow Web Locks API used for its cross-tab session
 * mutex), which would otherwise freeze the entire app on every page load.
 * Race it against a short timeout and fall back to unauthenticated. */
async function authHeader(): Promise<Record<string, string>> {
  try {
    const { auth: firebaseAuth } = await import("./firebase/config");
    if (firebaseAuth.currentUser) {
      const fbToken = await firebaseAuth.currentUser.getIdToken();
      if (fbToken) return { Authorization: `Bearer ${fbToken}` };
    }
  } catch {
    // Firebase auth not available or not signed in
  }

  try {
    const supabase = createClient();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("auth session lookup timed out")), AUTH_HEADER_TIMEOUT_MS)
    );
    const {
      data: { session },
    } = await Promise.race([supabase.auth.getSession(), timeout]);
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    // Supabase env vars unset, no session, network unreachable, or the
    // lookup timed out -- fall back to unauthenticated (demo-only)
    // requests rather than blocking the app.
    return {};
  }
}

/** After a successful write, tell every mounted useAsync() to refetch. */
function notifyIfWrite(method?: string) {
  if (method && method !== "GET" && typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...auth, ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`);
  }
  notifyIfWrite(init?.method);
  // DELETE endpoints (e.g. budgets/goals) return 204 with no body -- res.json()
  // would throw on the empty string, so short-circuit for callers typed <void>.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<{ status: string }>("/api/health"),
  dashboard: (userId: string) => apiFetch<DashboardSnapshot>(`/api/dashboard/${userId}`),
  // user_id must be threaded through explicitly -- ChatRequest defaults to
  // "demo-priya" server-side, so omitting it here would silently ignore
  // whatever persona the rest of the app (dashboard/simulate/timeline, all
  // of which use useUserId()) is currently showing.
  chat: (message: string, userId: string) =>
    apiFetch<AnswerContract>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, user_id: userId, force_offline: getOfflineOnly() }),
    }),
  simulate: (userId: string, req: SimulationRequest) =>
    apiFetch<SimulationResult>(`/api/simulate/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  addEvent: (userId: string, payload: Record<string, unknown>) =>
    apiFetch<RecomputeDiff>(`/api/events/${userId}`, { method: "POST", body: JSON.stringify(payload) }),

  // Transactions
  transactions: (userId: string, filters: TransactionFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return apiFetch<TransactionPage>(`/api/transactions/${userId}${qs ? `?${qs}` : ""}`);
  },
  updateTransaction: (userId: string, transactionId: string, update: TransactionUpdate) =>
    apiFetch<Transaction>(`/api/transactions/${userId}/${transactionId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
  reviewQueue: (userId: string, limit = 20) =>
    apiFetch<ReviewQueueResponse>(`/api/transactions/${userId}/review-queue?limit=${limit}`),
  reviewTransaction: (userId: string, transactionId: string, req: ReviewTransactionRequest) =>
    apiFetch<Transaction>(`/api/transactions/${userId}/${transactionId}/review`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // Categorization Rules
  rules: (userId: string) => apiFetch<CategorizationRuleList>(`/api/rules/${userId}`),
  createRule: (userId: string, req: CategorizationRuleCreate) =>
    apiFetch<CategorizationRule>(`/api/rules/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  deleteRule: (userId: string, ruleId: string) =>
    apiFetch<{ ok: boolean; deleted_id: string }>(`/api/rules/${userId}/${ruleId}`, { method: "DELETE" }),

  // Budgets
  budgets: (userId: string) => apiFetch<Budget[]>(`/api/budgets/${userId}`),
  createBudget: (userId: string, req: CreateBudgetRequest) =>
    apiFetch<Budget>(`/api/budgets/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  updateBudget: (userId: string, budgetId: string, req: UpdateBudgetRequest) =>
    apiFetch<Budget>(`/api/budgets/${userId}/${budgetId}`, { method: "PATCH", body: JSON.stringify(req) }),
  deleteBudget: (userId: string, budgetId: string) =>
    apiFetch<void>(`/api/budgets/${userId}/${budgetId}`, { method: "DELETE" }),
  budgetStatus: (userId: string) => apiFetch<BudgetStatus[]>(`/api/budgets/${userId}/status`),
  safeToSpend: (userId: string) => apiFetch<SafeToSpend>(`/api/budgets/${userId}/safe-to-spend`),

  // Goals
  goals: (userId: string) => apiFetch<GoalProgress[]>(`/api/goals/${userId}`),
  createGoal: (userId: string, req: CreateGoalRequest) =>
    apiFetch<GoalProgress | Goal>(`/api/goals/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  updateGoal: (userId: string, goalId: string, req: UpdateGoalRequest) =>
    apiFetch<Goal>(`/api/goals/${userId}/${goalId}`, { method: "PATCH", body: JSON.stringify(req) }),
  deleteGoal: (userId: string, goalId: string) =>
    apiFetch<void>(`/api/goals/${userId}/${goalId}`, { method: "DELETE" }),

  // Net worth + accounts
  netWorthHistory: (userId: string, days = 180) =>
    apiFetch<NetWorthHistory>(`/api/networth/${userId}/history?days=${days}`),
  accounts: (userId: string) => apiFetch<Account[]>(`/api/accounts/${userId}`),
  createAccount: (userId: string, req: CreateAccountRequest) =>
    apiFetch<Account>(`/api/accounts/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  /** Bank-statement CSV upload (multipart -- so no JSON Content-Type header). */
  upload: async (userId: string, file: File): Promise<RecomputeDiff> => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`${API_URL}/api/upload/${userId}`, {
      method: "POST",
      headers: await authHeader(),
      body,
    });
    if (!res.ok) throw new Error(`API upload failed: ${res.status} ${await res.text()}`);
    notifyIfWrite("POST");
    return res.json() as Promise<RecomputeDiff>;
  },

  // Notifications
  notifications: (userId: string) => apiFetch<NotificationItem[]>(`/api/notifications/${userId}`),

  // Household & Collaboration (Pillar 5D)
  household: (userId: string) => apiFetch<HouseholdSummary>(`/api/household/${userId}`),
  createHousehold: (userId: string, req: CreateHouseholdRequest) =>
    apiFetch<HouseholdSummary>(`/api/household/${userId}`, { method: "POST", body: JSON.stringify(req) }),
  createInvite: (userId: string, req: CreateInviteRequest) =>
    apiFetch<HouseholdInvite>(`/api/household/${userId}/invites`, { method: "POST", body: JSON.stringify(req) }),
  acceptInvite: (userId: string, token: string) =>
    apiFetch<HouseholdSummary>(`/api/household/${userId}/invites/accept`, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  revokeInvite: (userId: string, inviteId: string) =>
    apiFetch<{ revoked: boolean; id: string }>(`/api/household/${userId}/invites/${inviteId}`, { method: "DELETE" }),
  removeMember: (userId: string, memberUserId: string) =>
    apiFetch<{ removed: boolean; user_id: string }>(`/api/household/${userId}/members/${memberUserId}`, {
      method: "DELETE",
    }),

  // Tax Optimizer
  taxAnalysis: (userId: string) => apiFetch<TaxOptimizationAnalysis>(`/api/tax/${userId}/analysis`),
  calculateTax: (userId: string, req: TaxCalculationRequest) =>
    apiFetch<TaxOptimizationAnalysis>(`/api/tax/${userId}/calculate`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
};

