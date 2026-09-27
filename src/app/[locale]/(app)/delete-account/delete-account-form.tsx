"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Calls the same `delete-account` edge function the app uses, then signs out.
export function DeleteAccountForm() {
  const t = useTranslations("Legal");
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    "idle"
  );

  async function handleDelete() {
    setState("working");
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("delete-account", {
      method: "POST",
    });
    if (error) {
      setState("failed");
      return;
    }
    await supabase.auth.signOut();
    setState("done");
    // Re-render the header and page as signed out; the page shows the confirmation.
    router.replace("?deleted=1");
    router.refresh();
  }

  if (state === "done") {
    return (
      <p role="status" className="mt-4 font-medium">
        {t("deleteDone")}
      </p>
    );
  }

  const ready = confirm.trim() === t("deleteConfirmWord");
  return (
    <div className="mt-4 space-y-3">
      <Label htmlFor="delete-confirm">{t("deleteConfirmLabel")}</Label>
      <Input
        id="delete-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        className="max-w-xs"
      />
      {state === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {t("deleteFailed")}
        </p>
      )}
      <Button
        variant="destructive"
        disabled={!ready || state === "working"}
        aria-busy={state === "working"}
        onClick={handleDelete}
      >
        {state === "working" ? t("deleteWorking") : t("deleteButton")}
      </Button>
    </div>
  );
}
