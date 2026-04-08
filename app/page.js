import Link from 'next/link'

const roleHighlights = [
  {
    title: 'Member',
    description: 'Track workouts, attendance, body progress, payments, and personal goals.',
  },
  {
    title: 'Trainer',
    description: 'Coach assigned members, build plans, review attendance, and send reminders.',
  },
  {
    title: 'Admin',
    description: 'Manage members, trainers, plans, payments, reports, and gym announcements.',
  },
]

export default function Home() {
  return (
    <main className="lf-app-bg min-h-screen text-[var(--lf-text)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-10 md:px-8">
        <div className="lf-card mx-auto w-full max-w-5xl p-5 md:p-8">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--lf-border)] bg-[color-mix(in_srgb,var(--lf-surface-soft)_70%,transparent)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">
                <span className="h-2 w-2 rounded-full bg-[var(--lf-accent)]" />
                Gym Operating System
              </div>

              <h1
                className="text-4xl font-bold leading-tight md:text-5xl"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Lions Fitness
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--lf-text-soft)] md:text-base">
                Role-based fitness management platform with clean dashboards for Members, Trainers, and Admin.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/login" className="lf-btn-primary max-w-[180px] text-center">
                  Start Now
                </Link>
                <Link href="/dashboard" className="lf-btn-ghost text-center">
                  Continue Session
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              {roleHighlights.map((item) => (
                <article key={item.title} className="lf-item">
                  <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--lf-accent-soft)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--lf-text-soft)]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
