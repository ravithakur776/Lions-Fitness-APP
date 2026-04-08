'use client'

import Link from 'next/link'
import ThemeToggle from '@/src/app/components/theme-toggle'

export function RoleLayout({
  title,
  subtitle,
  userName,
  onLogout,
  children,
  navItems = [],
  currentPath,
  maxWidth = 'max-w-6xl',
}) {
  const initials = getInitials(userName)

  return (
    <main className="lf-app-bg min-h-screen text-[var(--lf-text)]">
      <div className={`mx-auto w-full px-4 py-5 md:px-6 md:py-7 ${maxWidth}`}>
        <header className="lf-card lf-rise-in mb-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--lf-accent)] text-sm font-bold text-white shadow-lg shadow-black/30">
                {initials}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--lf-text-soft)]">Lions Fitness</p>
                <h1
                  className="text-xl font-semibold leading-tight md:text-2xl"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {title}
                </h1>
                <p className="mt-0.5 text-sm text-[var(--lf-text-soft)]">{subtitle}</p>
                {userName && <p className="mt-1 text-xs text-[var(--lf-accent-soft)]">{userName}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/" className="lf-btn-ghost">
                Home
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={onLogout}
                className="lf-btn-ghost border-red-500/45 text-red-200 hover:bg-red-500/10"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          {navItems.length > 0 && (
            <aside className="lf-card lf-fade-in sticky top-4 hidden p-3 md:block">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lf-text-soft)]">
                Navigation
              </p>
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const active = currentPath === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                        active
                          ? 'bg-[color-mix(in_srgb,var(--lf-accent)_22%,transparent)]'
                          : 'hover:bg-[color-mix(in_srgb,var(--lf-surface-soft)_65%,transparent)]'
                      }`}
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <NavIcon label={item.label} active={active} />
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          active
                            ? 'text-[var(--lf-accent-soft)]'
                            : 'text-[var(--lf-text-soft)] group-hover:text-[var(--lf-text)]'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </nav>
            </aside>
          )}

          <section className="lf-fade-in pb-[96px] md:pb-0">{children}</section>
        </div>
      </div>

      {navItems.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
          <div className={`mx-auto w-full ${maxWidth} pointer-events-auto`}>
            <nav className="lf-card lf-mobile-nav p-2">
              <div className="lf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const active = currentPath === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex min-w-[68px] flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition ${
                        active
                          ? 'bg-[color-mix(in_srgb,var(--lf-accent)_22%,transparent)]'
                          : 'hover:bg-[color-mix(in_srgb,var(--lf-surface-soft)_60%,transparent)]'
                      }`}
                    >
                      <span className="mb-1 inline-flex h-5 w-5 items-center justify-center">
                        <NavIcon label={item.label} active={active} />
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          active ? 'text-[var(--lf-accent-soft)]' : 'text-[var(--lf-text-soft)]'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          </div>
        </div>
      )}
    </main>
  )
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`lf-card lf-card-interactive lf-rise-in p-4 ${className}`}>
      {title && (
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, accent = 'text-orange-300' }) {
  return (
    <article className="lf-card-soft lf-rise-in p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent}`}>{value}</p>
    </article>
  )
}

function getInitials(name) {
  const text = String(name || '').trim()
  if (!text) return 'LF'

  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function NavIcon({ label, active }) {
  const lower = String(label || '').toLowerCase()
  const stroke = active ? 'var(--lf-accent-soft)' : 'var(--lf-text-soft)'
  const fill = active ? 'color-mix(in srgb, var(--lf-accent) 78%, transparent)' : 'none'

  if (lower.includes('home')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill={fill} stroke={stroke} strokeWidth="1.8">
        <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    )
  }

  if (lower.includes('member') || lower.includes('profile') || lower.includes('trainer')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  }

  if (lower.includes('attend')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 10h18" />
      </svg>
    )
  }

  if (lower.includes('progress') || lower.includes('report')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M3 17l5-6 4 3 5-8 4 5" />
      </svg>
    )
  }

  if (lower.includes('pay') || lower.includes('plan')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M12 2v20" />
        <path d="M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
      </svg>
    )
  }

  if (lower.includes('workout')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M4 10v4M7 8v8M17 8v8M20 10v4M7 12h10" />
      </svg>
    )
  }

  if (lower.includes('alert') || lower.includes('notify')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M18 8a6 6 0 1 0-12 0c0 6-3 8-3 8h18s-3-2-3-8" />
        <path d="M10 21h4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
