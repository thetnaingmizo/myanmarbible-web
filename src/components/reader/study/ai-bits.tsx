"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudyError } from "../ai";

/** Gold "AI help" label used on every AI panel, as in the app. */
export function AiBadge({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("Study");
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-gold">
      <Sparkles className="size-4" aria-hidden />
      {children ?? t("aiHelp")}
    </p>
  );
}

export function AiLoading() {
  const t = useTranslations("Study");
  return (
    <div role="status" aria-busy="true" aria-label={t("aiThinking")} className="space-y-3 rounded-2xl bg-gold-tint/60 p-4">
      <p className="text-sm text-gold">{t("aiThinking")}</p>
      <Skeleton className="h-4 w-full bg-gold-tint" />
      <Skeleton className="h-4 w-5/6 bg-gold-tint" />
      <Skeleton className="h-4 w-2/3 bg-gold-tint" />
    </div>
  );
}

export function AiError({ error, onRetry }: { error: StudyError; onRetry?: () => void }) {
  const t = useTranslations("Study");
  return (
    <div role="alert" className="rounded-2xl bg-maroon-tint p-4 text-sm text-maroon">
      <p>{t(`err.${error}`)}</p>
      {onRetry && ["generation_failed", "server_error"].includes(error) && (
        <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
          {t("retry")}
        </button>
      )}
    </div>
  );
}

export function SignInPrompt({ reason, returnTo }: { reason: string; returnTo: string }) {
  const t = useTranslations("Study");
  return (
    <div className="rounded-2xl border border-line bg-sunk p-5 text-center">
      <p className="text-ink-2">{reason}</p>
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="mt-4 inline-flex h-10 items-center rounded-full bg-maroon-button px-5 text-sm font-semibold text-white"
      >
        {t("signIn")}
      </Link>
    </div>
  );
}

export function Disclaimer() {
  const t = useTranslations("Study");
  return <p className="text-xs leading-relaxed text-ink-3">{t("aiDisclaimer")}</p>;
}
