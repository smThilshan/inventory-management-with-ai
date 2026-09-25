'use client'; // Error boundaries must be Client Components

// Shown when the server render fails, typically because the API is unreachable.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Inventory is unavailable</h1>
      <p className="text-sm text-slate-600">
        The dashboard could not load data from the API. Check that it is running, then try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Try again
      </button>
    </main>
  );
}
