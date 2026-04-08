'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate, todayISODate } from '@/src/app/lib/format'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function TrainerAttendancePage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadAttendance = useCallback(async (uid) => {
    try {
      const membersSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))
      )

      const members = membersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      const monthKey = new Date().toISOString().slice(0, 7)
      const today = todayISODate()

      const enriched = await Promise.all(
        members.map(async (member) => {
          const attendanceSnap = await getDocs(collection(db, 'users', member.id, 'attendance'))
          const dates = attendanceSnap.docs.map((item) => item.data().date).filter(Boolean)

          const monthly = dates.filter((date) => String(date).startsWith(monthKey)).length
          const presentToday = dates.includes(today)

          return {
            ...member,
            monthlyAttendance: monthly,
            presentToday,
            lastAttendanceDate: dates.sort((a, b) => (a > b ? -1 : 1))[0] || null,
          }
        })
      )

      setRows(enriched)
    } catch {
      setStatus({ type: 'error', message: 'Could not load attendance reports.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadAttendance(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadAttendance, user])

  const summary = useMemo(() => {
    const total = rows.length
    const presentToday = rows.filter((item) => item.presentToday).length
    const avgMonthly =
      total > 0 ? Math.round(rows.reduce((sum, item) => sum + Number(item.monthlyAttendance || 0), 0) / total) : 0

    return { total, presentToday, avgMonthly }
  }, [rows])

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading attendance report..." />
  }

  return (
    <RoleLayout
      title="Attendance Reports"
      subtitle="Review member check-ins and consistency"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/attendance"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || status.message}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <StatCard label="Assigned Members" value={`${summary.total}`} />
        <StatCard label="Present Today" value={`${summary.presentToday}`} accent="text-green-300" />
        <StatCard label="Avg Monthly" value={`${summary.avgMonthly} days`} accent="text-yellow-300" />
      </section>

      <Card title="Member Attendance">
        {rows.length === 0 ? (
          <EmptyState title="No assigned members yet" message="Assign members to this trainer to start tracking attendance." />
        ) : (
          <div className="space-y-2">
            {rows.map((member) => (
              <article key={member.id} className="lf-item">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-orange-300">{member.displayName || 'Unnamed Member'}</p>
                    <p className="text-xs text-[var(--lf-text-soft)]">
                      This month: {member.monthlyAttendance || 0} days • Last: {formatDate(member.lastAttendanceDate)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] uppercase ${
                      member.presentToday ? 'bg-green-500/20 text-green-200' : 'bg-yellow-500/20 text-yellow-200'
                    }`}
                  >
                    {member.presentToday ? 'present' : 'absent'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}
