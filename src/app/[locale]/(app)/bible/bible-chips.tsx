import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Bible } from "@/lib/bible/data";

/** One chip per Bible; scrolls sideways on phones. */
export function BibleChips({ bibles, current, hrefFor }: { bibles: Bible[]; current: string; hrefFor: (b: Bible) => string | null }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {bibles.map((b) => {
        const href = hrefFor(b);
        const label = b.language === "my" && b.name_my ? b.name_my : b.name_en;
        const cls = cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
          b.id === current ? "border-maroon-button bg-maroon-button text-white" : "border-line bg-surface text-ink hover:bg-sunk"
        );
        const inner = (
          <>
            <span className="text-xs uppercase opacity-80">{b.code}</span>
            {label}
          </>
        );
        return href ? (
          <Link key={b.id} href={href} className={cls} aria-current={b.id === current ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <span key={b.id} className={cn(cls, "opacity-50")}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
