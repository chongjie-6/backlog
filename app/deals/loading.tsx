export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 h-10 w-64 animate-pulse rounded bg-zinc-800" />
      <div className="mb-8 h-20 animate-pulse rounded-xl bg-zinc-900/40" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60"
          >
            <div className="aspect-231/87 animate-pulse bg-zinc-800" />
            <div className="flex flex-col gap-3 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-zinc-800" />
              <div className="h-8 w-full animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
