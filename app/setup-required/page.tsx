export default function SetupRequiredPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Setup Required</h1>
      <p className="mt-4 max-w-xl text-base text-slate-600">
        Authentication is not configured for this deployment. Please set
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm">NEXT_PUBLIC_SUPABASE_URL</code>
        and
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        before accessing protected routes.
      </p>
    </main>
  )
}

