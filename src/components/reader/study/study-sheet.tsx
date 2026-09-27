"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SignInPrompt } from "./ai-bits";
import { ComparePanel } from "./compare-panel";
import type { StudyContext, StudyMode } from "./context";
import { ExplainPanel } from "./explain-panel";
import { NotePanel } from "./note-panel";
import { OriginalPanel } from "./original-panel";
import { ReportPanel } from "./report-panel";

const TITLE: Record<StudyMode, string> = {
  explain: "explainTitle",
  compare: "compareTitle",
  original: "wordsTitle",
  note: "noteTitle",
  report: "reportTitle",
};

/** Side panel for a verse action. Compare and Original work signed out; AI, notes and reports need an account. */
export function StudySheet({
  mode,
  ctx,
  returnTo,
  onClose,
}: {
  mode: StudyMode | null;
  ctx: StudyContext | null;
  returnTo: string;
  onClose: () => void;
}) {
  const t = useTranslations("Study");
  const open = !!mode && !!ctx;
  const needsAccount = mode === "explain" || mode === "note" || mode === "report";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined} side="right" className="w-full gap-0 overflow-y-auto bg-paper sm:max-w-lg">
        {open && (
          <>
            <SheetHeader className="border-b border-hairline">
              <SheetTitle className="font-serif text-xl">{t(TITLE[mode])}</SheetTitle>
            </SheetHeader>
            <div className="p-5">
              {needsAccount && !ctx.signedIn ? (
                <SignInPrompt reason={mode === "explain" ? t("signInForAi") : t("signInForMarkers")} returnTo={returnTo} />
              ) : mode === "explain" ? (
                <ExplainPanel ctx={ctx} />
              ) : mode === "compare" ? (
                <ComparePanel ctx={ctx} returnTo={returnTo} />
              ) : mode === "original" ? (
                <OriginalPanel ctx={ctx} returnTo={returnTo} />
              ) : mode === "note" ? (
                <NotePanel ctx={ctx} onDone={onClose} />
              ) : (
                <ReportPanel ctx={ctx} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
