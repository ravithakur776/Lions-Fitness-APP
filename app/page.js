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

const quickStats = [
  { label: 'Role Dashboards', value: '3' },
  { label: 'Core Modules', value: '12+' },
  { label: 'Live Tracking', value: '24/7' },
]

export default function Home() {
  return (
    <main className="lf-app-bg min-h-screen text-[var(--lf-text)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-10 md:px-8">
        <div className="lf-card lf-soft-glow mx-auto w-full max-w-5xl p-5 md:p-8">
          <div className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr]">
            <div className="lf-stagger">
              <div className="lf-chip w-fit">
                <span className="lf-dot" />
                Gym Operating System
              </div>

              <h1
                className="mt-4 text-4xl font-bold leading-tight md:text-6xl"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                <span className="lf-gradient-title">Lions Fitness</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--lf-text-soft)] md:text-base">
                Role-based fitness management platform with clean dashboards for Members, Trainers, and Admin.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/login" className="lf-btn-primary w-full max-w-[190px] text-center">
                  Start Now
                </Link>
                <Link href="/dashboard" className="lf-btn-ghost px-4 py-2 text-center text-sm">
                  Continue Session
                </Link>
              </div>

              <div className="lf-divider my-6" />

              <div className="grid gap-2 sm:grid-cols-3">
                {quickStats.map((item) => (
                  <article key={item.label} className="lf-card-soft p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--lf-text)]">{item.value}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="lf-stagger grid gap-3">
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
