"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  redirectTo?: string;
  error?: string;
};

type ErrorKey = "invalidEmail" | "invalidCode" | "tooMany" | "failed" | "callback";

const RESEND_SECONDS = 60;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

// Google or a 6-digit email code: no passwords, no magic links, no phone.
export function LoginForm({ redirectTo, error: initialError }: Props) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const next = redirectTo ?? `/${locale}`;
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<ErrorKey | null>(initialError ? "callback" : null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function send() {
    setError(null);
    startTransition(async () => {
      const r = await sendEmailCode(email);
      if ("error" in r) return setError(r.error);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    });
  }

  function verify(value = code) {
    setError(null);
    startTransition(async () => {
      const r = await verifyEmailCode(email, value, next, locale);
      if (r && "error" in r) setError(r.error);
    });
  }

  function google() {
    setError(null);
    startTransition(async () => {
      const r = await signInWithGoogle(next, locale);
      if (r && "error" in r) setError(r.error);
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-7 sm:p-9">
        <h1 className="font-serif text-2xl font-semibold text-ink">{t("signInTitle")}</h1>
        <p className="mt-2 text-ink-3">{t("signInLead")}</p>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-maroon-tint px-4 py-3 text-sm text-maroon">
            {t(`error.${error}`)}
          </p>
        )}

        {step === "email" ? (
          <>
            <Button variant="outline" size="lg" className="mt-6 w-full" onClick={google} disabled={pending}>
              <GoogleMark />
              {t("continueWithGoogle")}
            </Button>

            <div className="my-6 flex items-center gap-3 text-sm text-ink-3">
              <span className="h-px flex-1 bg-line" />
              {t("or")}
              <span className="h-px flex-1 bg-line" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="space-y-3"
            >
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="lg" className="w-full" disabled={pending || !email} aria-busy={pending}>
                {t("sendCode")}
              </Button>
            </form>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
            className="mt-6 space-y-3"
          >
            <p className="text-sm text-ink-2">{t("codeSentTo", { email })}</p>
            <Label htmlFor="code">{t("enterCode")}</Label>
            <Input
              ref={codeRef}
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            />
            <Button type="submit" size="lg" className="w-full" disabled={pending || code.length !== 6} aria-busy={pending}>
              {t("verify")}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 pt-1 text-sm">
              <button
                type="button"
                className="font-semibold text-maroon disabled:text-ink-3"
                onClick={send}
                disabled={pending || cooldown > 0}
              >
                {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resendCode")}
              </button>
              <button
                type="button"
                className="text-ink-2 hover:underline"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                {t("changeEmail")}
              </button>
            </div>
          </form>
        )}

        <p className="mt-7 text-xs leading-relaxed text-ink-3">
          {t.rich("agree", {
            terms: (chunks) => (
              <Link href="/terms" className="underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
