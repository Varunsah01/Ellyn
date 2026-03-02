import { Card, CardContent, CardHeader } from "@/components/ui/Card";

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-slate-200" />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-200" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="h-6 w-36 animate-pulse rounded bg-slate-200" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
        </CardContent>
      </Card>
    </div>
  );
}
