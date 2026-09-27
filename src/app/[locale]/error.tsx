"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("error")}</h1>
      <p className="mt-2 text-ink-3">{t("errorBody")}</p>
      <Button className="mt-8" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
