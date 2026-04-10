'use client'

export function PageLoader({ label = 'Loading...' }) {
  return (
    <main className="lf-app-bg flex min-h-screen items-center justify-center p-4 text-[var(--lf-text)]">
      <div className="lf-card lf-soft-glow w-full max-w-md p-5">
        <div className="lf-chip mb-3 w-fit">
          <span className="lf-dot" />
          Lions Fitness
        </div>
        <div className="lf-skeleton mb-3 h-4 w-32 rounded-md" />
        <div className="lf-skeleton mb-2 h-3 w-full rounded-md" />
        <div className="lf-skeleton mb-2 h-3 w-10/12 rounded-md" />
        <div className="lf-skeleton h-3 w-8/12 rounded-md" />
        <p className="mt-4 text-xs text-[var(--lf-text-soft)]">{label}</p>
      </div>
    </main>
  )
}

export function EmptyState({
  title = 'Nothing to show yet',
  message = 'Data will appear here once records are available.',
  className = '',
}) {
  return (
    <div className={`lf-card-soft lf-fade-in p-5 text-center ${className}`}>
      <p className="text-sm font-semibold text-[var(--lf-text)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--lf-text-soft)]">{message}</p>
    </div>
  )
}
