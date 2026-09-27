"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateReaderSettings, useReaderSettings, type ReaderTheme, type Spacing } from "./settings";

const THEMES: { id: ReaderTheme; key: string; bg: string; ink: string }[] = [
  { id: "auto", key: "themeAuto", bg: "linear-gradient(135deg,#fbf8f3 50%,#15110f 50%)", ink: "#882c2c" },
  { id: "paper", key: "themePaper", bg: "#fbf8f3", ink: "#1f1815" },
  { id: "sepia", key: "themeSepia", bg: "#f4ecd8", ink: "#3b2a1a" },
  { id: "night", key: "themeNight", bg: "#15110f", ink: "#f2eae2" },
  { id: "black", key: "themeBlack", bg: "#000000", ink: "#ede6df" },
  { id: "contrast", key: "themeContrast", bg: "#ffffff", ink: "#000000" },
];

const SPACINGS: { id: Spacing; key: string }[] = [
  { id: "compact", key: "spacingCompact" },
  { id: "normal", key: "spacingNormal" },
  { id: "relaxed", key: "spacingRelaxed" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between py-2 text-sm font-medium"
    >
      {label}
      <span className={cn("flex h-6 w-10 items-center rounded-full p-0.5 transition-colors", on ? "bg-maroon-button" : "bg-line")}>
        <span className={cn("size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-4")} />
      </span>
    </button>
  );
}

/** "Aa" panel: theme, text size, line spacing, paragraphs, verse numbers. */
export function DisplaySettings() {
  const t = useTranslations("Bible");
  const s = useReaderSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("textSettings")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("font-serif text-lg font-semibold", open && "bg-maroon-tint text-maroon")}
      >
        Aa
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label={t("textSettings")}
          className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-line bg-surface p-4 text-ink shadow-xl"
        >
          <p className="mb-2 text-sm font-semibold text-ink-3">{t("colorTheme")}</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                aria-pressed={s.theme === th.id}
                onClick={() => updateReaderSettings({ theme: th.id })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-medium",
                  s.theme === th.id ? "border-maroon ring-2 ring-maroon/30" : "border-line"
                )}
              >
                <span className="grid h-8 w-full place-items-center rounded-lg border border-black/10 font-serif text-sm" style={{ background: th.bg, color: th.ink }}>
                  Aa
                </span>
                {t(th.key)}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-sm font-semibold text-ink-3">{t("textSize")}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label={t("smaller")} disabled={s.size <= -3} onClick={() => updateReaderSettings({ size: s.size - 1 })}>
              <Minus aria-hidden />
            </Button>
            <div className="h-1.5 flex-1 rounded-full bg-sunk" aria-hidden>
              <div className="h-full rounded-full bg-maroon-button" style={{ width: `${((s.size + 3) / 8) * 100}%` }} />
            </div>
            <Button variant="outline" size="icon-sm" aria-label={t("larger")} disabled={s.size >= 5} onClick={() => updateReaderSettings({ size: s.size + 1 })}>
              <Plus aria-hidden />
            </Button>
          </div>

          <p className="mb-2 mt-4 text-sm font-semibold text-ink-3">{t("lineSpacing")}</p>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-sunk p-1">
            {SPACINGS.map((sp) => (
              <button
                key={sp.id}
                type="button"
                aria-pressed={s.spacing === sp.id}
                onClick={() => updateReaderSettings({ spacing: sp.id })}
                className={cn("rounded-full py-1.5 text-xs font-semibold", s.spacing === sp.id ? "bg-surface text-maroon shadow-sm" : "text-ink-2")}
              >
                {t(sp.key)}
              </button>
            ))}
          </div>

          <div className="mt-3 divide-y divide-hairline">
            <Toggle on={s.paragraphs} onChange={(v) => updateReaderSettings({ paragraphs: v })} label={t("paragraphMode")} />
            <Toggle on={s.numbers} onChange={(v) => updateReaderSettings({ numbers: v })} label={t("verseNumbers")} />
          </div>
        </div>
      )}
    </div>
  );
}
