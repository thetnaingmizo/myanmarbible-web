import { cn } from "@/lib/utils";

// Content-shaped placeholder in the app's skeleton colour. Decorative: the
// region that shows skeletons carries aria-busy and a label.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-skeleton", className)}
      {...props}
    />
  );
}

export { Skeleton };
