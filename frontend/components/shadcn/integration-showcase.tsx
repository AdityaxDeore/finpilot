"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Integration {
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip, e.g. "bg-tint-sky text-sky". */
  tone?: string;
}

export interface IntegrationShowcaseProps {
  /** Wrap the word to highlight in `~`, e.g. "Connect your ~favorite~ tools". */
  title: string;
  subtitle: string;
  /** Optional decorative element shown beside the heading. */
  illustration?: React.ReactNode;
  integrations: Integration[];
  className?: string;
}

const HighlightedTitle = ({ text }: { text: string }) => {
  const parts = text.split(/~/);
  return (
    <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
      {parts.map((part, index) =>
        index === 1 ? (
          <span key={index} className="relative whitespace-nowrap">
            <span className="relative">{part}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 418 42"
              className="absolute -bottom-1.5 left-0 h-auto w-full text-lime-dark"
              preserveAspectRatio="none"
            >
              <path
                d="M203.371.916c-26.013-2.078-76.686 1.98-114.243 8.919-37.556 6.939-78.622 17.103-122.256 28.703-43.633 11.6-4.984 14.306 43.123 7.021 48.107-7.285 93.638-16.096 146.446-17.742 52.808-1.646 105.706 5.429 158.649 14.13 52.943 8.701 105.886 19.342 158.826 29.483 52.94 10.141 52.94 10.141-11.41-19.043C371.18 14.363 322.753 5.488 281.339 2.143 239.925-1.201 203.371.916 203.371.916z"
                fill="currentColor"
              />
            </svg>
          </span>
        ) : (
          part
        ),
      )}
    </h2>
  );
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export const IntegrationShowcase = React.forwardRef<HTMLElement, IntegrationShowcaseProps>(
  ({ title, subtitle, illustration, integrations, className }, ref) => (
    <section ref={ref} className={cn("w-full py-8", className)}>
      <div className="grid grid-cols-1 items-center gap-x-12 gap-y-6 lg:grid-cols-2">
        <div className="max-w-xl">
          <HighlightedTitle text={title} />
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        </div>
        {illustration && <div className="flex items-center justify-center">{illustration}</div>}
      </div>

      <motion.div
        className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {integrations.map(({ name, description, icon: Icon, tone }) => (
          <motion.div key={name} variants={itemVariants} className="flex items-start gap-4">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone ?? "bg-fog text-graphite")}>
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  ),
);

IntegrationShowcase.displayName = "IntegrationShowcase";
