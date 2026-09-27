import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Figtree, Literata, Noto_Sans_Myanmar } from "next/font/google";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Same families as the app (app_typography.dart): Figtree for Latin UI,
// Literata for Latin scripture and display, Noto Sans Myanmar for Burmese.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  display: "swap",
});

const notoSansMyanmar = Noto_Sans_Myanmar({
  variable: "--font-noto-myanmar",
  weight: ["400", "500", "600", "700"],
  subsets: ["myanmar"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Myanmar Bible",
    template: "%s | Myanmar Bible",
  },
  description:
    "Read the Bible in Burmese and English, and study it with answers that cite real verses.",
};

type Props = {
  children: ReactNode;
};

export default async function RootLayout({ children }: Props) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${figtree.variable} ${literata.variable} ${notoSansMyanmar.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
