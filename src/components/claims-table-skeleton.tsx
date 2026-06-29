import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClaimsTableLoadingSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 3;

  return (
    <Card className="overflow-hidden p-0">
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="space-y-0 border-t border-zinc-100 p-4"
        >
          <Skeleton className="h-4 w-32" />
          <div className="mt-3 grid grid-cols-4 gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-16 justify-self-end" />
          </div>
        </div>
      ))}
    </Card>
  );
}
