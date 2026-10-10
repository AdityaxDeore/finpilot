"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { signOut, onAuthChange } from "@/lib/firebase/auth";
import type { User } from "firebase/auth";

/** Header/sidebar auth control: links to the /login page, or shows the signed-in user with Sign out. */
export function SignInButton() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(setCurrentUser);
    return () => unsubscribe();
  }, []);

  if (currentUser) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-leaf/25 bg-leaf/10 px-2.5 py-1 text-xs">
          <span className="size-1.5 animate-pulse rounded-full bg-leaf" />
          <span className="max-w-32 truncate font-medium text-leaf" title={currentUser.email || currentUser.uid}>
            {currentUser.displayName || currentUser.email || "Signed in"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut().catch((e) => console.error("Sign out failed", e))}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" asChild className="rounded-full bg-lime text-ink hover:bg-lime/85">
      <Link href="/login">
        <LogIn /> Sign in
      </Link>
    </Button>
  );
}
