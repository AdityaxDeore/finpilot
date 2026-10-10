import type { ReactNode } from "react";
import { NavShell } from "@/components/NavShell";
import { Toaster } from "@/components/shadcn/sonner";
import { CopilotToaster } from "@/components/copilot/CopilotToaster";

/**
 * Shell for the authed app routes (dashboard/copilot/simulate/timeline).
 * Deliberately does NOT hard-block on auth: the "Try demo" path uses
 * user_id="demo-priya" client-side (see lib/user.ts) and always works, even
 * if Firebase Auth isn't configured in a given environment. Real sign-in is
 * additive, not a gate, which keeps the hackathon demo resilient.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NavShell>
      {children}
      <CopilotToaster />
      <Toaster richColors position="top-right" />
    </NavShell>
  );
}
