'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, orderBy, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatCurrencyINR, todayISODate } from '@/src/app/lib/format'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { PageLoader } from '@/src/app/components/ui-states'

export default function AdminDashboardPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [seeding, setSeeding] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [usersSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'))),
      ])

      setUsers(usersSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
      setPayments(paymentsSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load admin data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadData()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadData, user])

  const stats = useMemo(() => {
    const members = users.filter((item) => item.role === USER_ROLES.MEMBER)
    const activeToday = members.filter((item) => item.lastAttendanceDate === new Date().toISOString().slice(0, 10)).length

    const monthlyRevenue = payments
      .filter((item) => String(item.paidAt || '').startsWith(new Date().toISOString().slice(0, 7)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const overdue = payments.filter((item) => item.status === 'overdue').length

    return {
      totalMembers: members.length,
      activeToday,
      monthlyRevenue,
      overdue,
    }
  }, [payments, users])

  const seedDemoData = useCallback(async () => {
    if (!user || !db) return

    try {
      setSeeding(true)
      setStatus({ type: '', message: '' })

      const plansSnap = await getDocs(collection(db, 'membershipPlans'))
      if (plansSnap.empty) {
        await Promise.all([
          addDoc(collection(db, 'membershipPlans'), {
            name: 'Basic',
            price: 1499,
            durationDays: 30,
            features: ['Gym Access', 'Locker Access'],
            createdAt: new Date().toISOString(),
          }),
          addDoc(collection(db, 'membershipPlans'), {
            name: 'Premium',
            price: 2499,
            durationDays: 30,
            features: ['Gym Access', 'Locker', 'Trainer Support'],
            createdAt: new Date().toISOString(),
          }),
          addDoc(collection(db, 'membershipPlans'), {
            name: 'Elite',
            price: 3999,
            durationDays: 30,
            features: ['All Access', 'Personal Trainer', 'Diet Guidance'],
            createdAt: new Date().toISOString(),
          }),
        ])
      }

      const announcementsSnap = await getDocs(collection(db, 'announcements'))
      if (announcementsSnap.empty) {
        await addDoc(collection(db, 'announcements'), {
          title: 'Welcome to Lions Fitness',
          message: 'Check your dashboard daily for workouts, progress, and reminders.',
          severity: 'low',
          createdBy: user.uid,
          createdAt: new Date().toISOString(),
        })
      }

      const members = users.filter((item) => item.role === USER_ROLES.MEMBER)
      const existingPaymentSnap = await getDocs(collection(db, 'payments'))
      if (existingPaymentSnap.empty && members.length > 0) {
        const today = todayISODate()
        await Promise.all(
          members.slice(0, 5).map((member, index) =>
            addDoc(collection(db, 'payments'), {
              memberId: member.id,
              memberName: member.displayName || member.email || 'Member',
              planName: member.membershipPlanName || 'Basic',
              amount: Number(member.membershipPlanName === 'Premium' ? 2499 : 1499),
              dueDate: today,
              status: index % 3 === 0 ? 'paid' : 'pending',
              paidAt: index % 3 === 0 ? today : null,
              createdAt: new Date().toISOString(),
            })
          )
        )
      }

      await loadData()
      setStatus({ type: 'success', message: 'Demo data prepared successfully.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not prepare demo data.' })
    } finally {
      setSeeding(false)
    }
  }, [loadData, user, users])

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading admin dashboard..." />
  }

  return (
    <RoleLayout
      title="Admin Dashboard"
      subtitle="Full gym overview and management"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/dashboard"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div className={`lf-alert ${(error || status.type === 'error') ? 'is-error' : 'is-success'}`}>
          {error || status.message}
        </div>
      )}

      <section className="lf-card lf-hero-panel mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--lf-accent-soft)]">Operations Snapshot</p>
            <h2 className="mt-1 text-xl font-semibold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {stats.totalMembers} members • {formatCurrencyINR(stats.monthlyRevenue)} this month
            </h2>
            <p className="mt-1 text-sm text-[var(--lf-text-soft)]">
              Monitor growth, control dues, and keep communication consistent.
            </p>
          </div>
          <div className={`lf-status-pill ${stats.overdue > 0 ? 'is-warn' : 'is-good'}`}>
            {stats.overdue > 0 ? `${stats.overdue} overdue` : 'all dues healthy'}
          </div>
        </div>
      </section>

      <section className="lf-kpi-grid mb-4 md:grid-cols-4">
        <StatCard label="Total Members" value={`${stats.totalMembers}`} />
        <StatCard label="Active Today" value={`${stats.activeToday}`} accent="text-green-300" />
        <StatCard label="Revenue (Month)" value={formatCurrencyINR(stats.monthlyRevenue)} accent="text-green-300" />
        <StatCard label="Overdue" value={`${stats.overdue}`} accent="text-red-300" />
      </section>

      <Card title="Management Areas">
        <div className="grid gap-2 md:grid-cols-2">
          <QuickLink href="/admin/members" label="Manage Members" desc="Add, edit, assign plans" tone="purple" />
          <QuickLink href="/admin/plans" label="Membership Plans" desc="Basic, Premium, Elite" tone="green" />
          <QuickLink href="/admin/payments" label="Payments" desc="Record dues and receipts" tone="yellow" badge={stats.overdue > 0 ? `${stats.overdue}` : undefined} />
          <QuickLink href="/admin/announcements" label="Announcements" desc="Gym-wide notifications" tone="red" />
          <QuickLink href="/admin/reports" label="Reports" desc="Revenue and attendance analytics" tone="neutral" />
          <QuickLink href="/admin/trainers" label="Manage Trainers" desc="Assign trainer roles" tone="purple" />
        </div>
      </Card>

      <Card title="Quick Setup" className="mt-4">
        <p className="mb-3 text-sm text-[var(--lf-text-soft)]">
          One-click setup to create starter plans, announcement, and sample payment data.
        </p>
        <button
          type="button"
          onClick={seedDemoData}
          disabled={seeding}
          className="lf-btn-primary max-w-[220px]"
        >
          {seeding ? 'Preparing...' : 'Prepare Demo Data'}
        </button>
      </Card>
    </RoleLayout>
  )
}

function QuickLink({ href, label, desc, tone = 'neutral', badge }) {
  const tones = {
    purple: 'text-indigo-200',
    green: 'text-green-200',
    yellow: 'text-yellow-200',
    red: 'text-red-200',
    neutral: 'text-[var(--lf-text)]',
  }

  return (
    <Link href={href} className="lf-item flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg border border-current/45 bg-black/15 px-2 py-1 text-[10px] uppercase ${tones[tone]}`}>
          Menu
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--lf-text)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--lf-text-soft)]">{desc}</p>
        </div>
      </div>
      {badge ? (
        <span className="rounded-full border border-red-500/50 bg-red-500/15 px-2 py-1 text-[10px] text-red-200">
          {badge}
        </span>
      ) : (
        <span className="text-[var(--lf-text-soft)]">›</span>
      )}
    </Link>
  )
}
