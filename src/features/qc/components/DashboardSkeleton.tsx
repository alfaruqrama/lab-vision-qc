import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

/**
 * Skeleton loading state for the QC Dashboard page.
 * Shows placeholder stat cards and record cards.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>

      {/* Stat chips skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-6 w-12" />
          </Card>
        ))}
      </div>

      {/* Today's records skeleton */}
      <div>
        <Skeleton className="h-4 w-36 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-14 mt-1" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="text-center space-y-1">
                    <Skeleton className="h-3 w-6 mx-auto" />
                    <Skeleton className="h-4 w-10 mx-auto" />
                    <Skeleton className="h-4 w-12 mx-auto rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
