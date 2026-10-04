import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://finpilot.ai"),
  title: "FinPilot — AI Financial Health Copilot",
  description:
    "A consolidated view of your financial health: spending patterns, debt pressure, cash-flow forecasts, and recommendations with their expected impact.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "FinPilot — AI Financial Health Copilot",
    description:
      "Autonomous AI Financial Health Copilot & Private Wealth Intelligence Engine.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FinPilot" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinPilot — AI Financial Health Copilot",
    description:
      "Autonomous AI Financial Health Copilot & Private Wealth Intelligence Engine.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

import { CurrencyProvider } from "@/lib/currency";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <CurrencyProvider>{children}</CurrencyProvider>
      </body>
    </html>
  );
}
