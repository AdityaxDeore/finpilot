"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignInButton } from "@/components/SignInButton";
import { NotificationBell } from "@/components/NotificationBell";
import { FinPilotLogo } from "@/components/FinPilotLogo";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ConfettiCanvas } from "@/components/ui/Confetti";
import { useUserId } from "@/lib/hooks";
import { DEMO_PERSONAS, isDemoUserId, setUserId } from "@/lib/user";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
  { href: "/household", label: "Household" },
  { href: "/copilot", label: "Copilot" },
  { href: "/simulate", label: "Simulate" },
  { href: "/plan", label: "Plan" },
  { href: "/tax", label: "Tax" },
  { href: "/timeline", label: "Timeline" },
  { href: "/statement", label: "Statement" },
  { href: "/security", label: "Security" },
];
// Secondary links collapse into a "More" menu below 1600px to keep the header on one line.
const PRIMARY_COUNT = 8;


const PERSONA_DETAILS: Record<string, { city: string; tag: string }> = {
  "demo-priya": { city: "Bengaluru", tag: "₹95k/mo" },
  "demo-arjun": { city: "Mumbai", tag: "₹160k/mo" },
  "demo-meera": { city: "Pune", tag: "₹42k/mo" },
};

/** Segmented control for switching between the seeded demo personas */
function PersonaSwitcher() {
  const userId = useUserId();
  // Signed-in users only see their own data -- no demo personas.
  if (!isDemoUserId(userId)) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Demo persona"
      className="flex items-center gap-1 rounded-full border border-mist bg-paper/70 p-1 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      {DEMO_PERSONAS.map((persona) => {
        const active = userId === persona.id;
        const details = PERSONA_DETAILS[persona.id];
        return (
          <button
            key={persona.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setUserId(persona.id)}
            className={cn(
              "relative px-3 py-1.5 text-xs font-medium cursor-pointer rounded-full transition-colors whitespace-nowrap flex items-center gap-1.5",
              active ? "text-ink font-semibold" : "text-graphite hover:text-ink"
            )}
          >
            {active && (
              <motion.div
                layoutId="active-persona-pill"
                className="absolute inset-0 rounded-full bg-paper shadow-[0_1px_4px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] border border-mist"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-ember" : "bg-steel/50"
                )}
              />
              <span>{persona.label}</span>
              {details && (
                <span className="text-[10px] text-pewter font-normal hidden min-[1700px]:inline">
                  {details.tag}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function NavShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const userId = useUserId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = LINKS.slice(PRIMARY_COUNT).some((l) => pathname?.startsWith(l.href));

  // Close drawer/menu on route change and Escape.
  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background overflow-x-hidden">
      <header className="sticky top-0 z-50 glass-header">
        <div className="flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
          {/* Logo flush left -> home */}
          <Link href="/" className="flex shrink-0 items-center gap-2 group" aria-label="FinPilot home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 p-1 border border-mist group-hover:scale-105 transition-transform">
              <FinPilotLogo size={22} />
            </div>
            <span className="font-display text-lg font-medium tracking-tight text-ink">FinPilot</span>
            <span className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse shadow-[0_0_6px_rgba(255,89,0,0.6)]" />
          </Link>

          {/* Desktop links spread through the middle */}
          <nav aria-label="Primary" className="hidden lg:flex min-w-0 flex-1 items-center justify-evenly">
            {LINKS.map((link, i) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                    i >= PRIMARY_COUNT && "hidden min-[1600px]:flex",
                    active ? "text-ink font-semibold" : "text-graphite hover:text-ink hover:bg-fog"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 rounded-full bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-mist"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
            <div className="relative min-[1600px]:hidden">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={cn(
                  "flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium cursor-pointer transition-colors",
                  moreActive ? "bg-paper text-ink font-semibold border border-mist" : "text-graphite hover:text-ink hover:bg-fog"
                )}
              >
                More <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-mist bg-paper p-1.5 shadow-lg">
                    {LINKS.slice(PRIMARY_COUNT).map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        className={cn(
                          "flex h-10 items-center rounded-xl px-3 text-sm font-medium hover:bg-fog",
                          pathname?.startsWith(link.href) ? "text-ink font-semibold" : "text-graphite"
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="mt-1.5 border-t border-mist px-1.5 pt-2.5 pb-1 xl:hidden">
                      <PersonaSwitcher />
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Actions flush right */}
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("finpilot:open-command-palette"))}
              className="flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-mist bg-paper/80 text-xs text-graphite hover:text-ink hover:border-black/20 transition-all cursor-pointer sm:h-9 sm:w-auto sm:px-3"
              title="Open Command Palette (Ctrl+K)"
              aria-label="Open Command Palette"
            >
              <Search className="h-4 w-4 text-pewter" />
              <kbd className="hidden sm:inline-flex items-center rounded border border-mist bg-fog px-1.5 text-[10px] font-semibold text-pewter">
                ⌘K
              </kbd>
            </button>
            <div className="hidden sm:block">
              <CurrencySelector />
            </div>
            <div className="hidden xl:block">
              <PersonaSwitcher />
            </div>
            <NotificationBell userId={userId} />
            <div className="hidden sm:flex items-center">
              <SignInButton />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex lg:hidden h-11 w-11 items-center justify-center rounded-full border border-mist bg-paper text-ink hover:bg-fog transition-colors cursor-pointer"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-drawer"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer: full-width slide-down */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-x-0 bottom-0 top-14 z-40 bg-black/30 lg:hidden"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <motion.div
                key="drawer"
                id="mobile-drawer"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-mist bg-paper px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden"
              >
                <nav aria-label="Mobile" className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {LINKS.map((link) => {
                    const active = pathname?.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center rounded-xl px-4 text-base font-medium transition-colors",
                          active ? "bg-ink text-paper font-semibold" : "text-graphite hover:bg-fog hover:text-ink"
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-3 flex flex-col gap-3 border-t border-mist pt-3">
                  <PersonaSwitcher />
                  <div className="flex items-center justify-between gap-3 sm:hidden">
                    <SignInButton />
                    <CurrencySelector />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5 lg:px-8">
        {children}
      </main>

      <CommandPalette />
      <ConfettiCanvas />
    </div>
  );
}
