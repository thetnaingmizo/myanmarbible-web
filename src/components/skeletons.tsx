import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level loading states (used by loading.tsx files). Each mirrors the
// shape of the page it stands in for, so navigation swaps instantly.

function Busy({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("Common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className={className}>
      {children}
    </div>
  );
}

function Lines({ count, last = "w-2/3" }: { count: number; last?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === count - 1 ? last : "w-full"}`} />
      ))}
    </>
  );
}

/** Heading + a few paragraphs. */
export function PageSkeleton() {
  return (
    <Busy className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
      <div className="space-y-3 pt-4">
        <Lines count={5} />
      </div>
      <div className="space-y-3 pt-4">
        <Lines count={4} last="w-1/2" />
      </div>
    </Busy>
  );
}

/** Heading + a grid of cards (characters, lessons, blog, podcast, questions). */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Busy className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <Skeleton className="h-5 w-3/4" />
            <Lines count={3} last="w-1/2" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Chips in a grid (Bible books, chapter numbers). */
export function ChipGridSkeleton({ chips = 40 }: { chips?: number }) {
  return (
    <Busy className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-48" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: chips }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
    </Busy>
  );
}

/** Chapter heading + scripture paragraphs. */
export function ReaderSkeleton() {
  return (
    <Busy className="mx-auto max-w-[680px] px-5 py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-40" />
      {[6, 5, 7].map((n, i) => (
        <div key={i} className="mt-8 space-y-4">
          <Lines count={n} />
        </div>
      ))}
    </Busy>
  );
}

/** Conversation list + message area (Ask, verse finder). */
export function ChatSkeleton() {
  return (
    <Busy className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <Lines count={4} />
      </div>
      <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
      <Skeleton className="mt-auto h-12 w-full rounded-full" />
    </Busy>
  );
}

/** Rows (bookmarks, admin tables, settings). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Busy className="mx-auto max-w-3xl space-y-3 px-4 py-10 sm:px-6">
      <Skeleton className="mb-6 h-9 w-48" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </Busy>
  );
}
