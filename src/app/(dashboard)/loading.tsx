// Instant skeleton shown during route navigation within the app shell, so
// transitions feel immediate instead of blocking on server data.
export default function Loading() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-56 animate-pulse rounded-md bg-surface-2" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface p-4 shadow-card">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-surface p-5 shadow-card">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
            <div className="mt-4 h-48 w-full animate-pulse rounded-lg bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
