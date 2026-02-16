import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Padauk } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const padauk = Padauk({
  variable: "--font-padauk",
  weight: ["400", "700"],
  subsets: ["myanmar"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MyanmarBible AI",
    template: "%s | MyanmarBible AI",
  },
  description:
    "AI-powered Myanmar Bible study companion. Ask questions, find verses, and deepen your understanding.",
};

type Props = {
  children: ReactNode;
};

export default async function RootLayout({ children }: Props) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${padauk.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
