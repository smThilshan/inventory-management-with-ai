export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <p className="sr-only">Loading inventory…</p>
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </main>
  );
}
