export function PageSkeleton({
  label,
  cards = 2,
}: {
  label: string;
  cards?: number;
}) {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true">
      <div className="skeleton h-3 w-28 rounded" />
      <div className="skeleton mt-4 h-9 w-64 max-w-full rounded-lg" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full rounded" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-44 rounded-3xl border border-zinc-800 bg-zinc-900 p-5" aria-hidden>
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton mt-5 h-6 w-3/4 rounded" />
            <div className="skeleton mt-4 h-4 w-full rounded" />
            <div className="skeleton mt-8 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <p role="status" className="sr-only">{label}</p>
    </main>
  );
}
