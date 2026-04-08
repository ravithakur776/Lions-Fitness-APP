'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function TrainerDashboardPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadData = useCallback(async (uid) => {
    try {
      const [membersSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))),
        getDocs(query(collection(db, 'workoutPlans'), where('createdBy', '==', uid))),
      ])

      setMembers(membersSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
      setPlans(plansSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load trainer data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadData(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadData, user])

  const metrics = useMemo(() => {
    const checkedInToday = members.filter((item) => item.lastAttendanceDate === new Date().toISOString().slice(0, 10)).length
    return {
      totalMembers: members.length,
      checkedInToday,
      workoutPlans: plans.length,
      pendingReviews: Math.max(0, members.length - checkedInToday),
    }
  }, [members, plans])

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading trainer dashboard..." />
  }

  return (
    <RoleLayout
      title="Trainer Dashboard"
      subtitle="Manage members, plans, and engagement"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/dashboard"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || status.message}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="My Members" value={`${metrics.totalMembers}`} />
        <StatCard label="Checked-in Today" value={`${metrics.checkedInToday}`} accent="text-green-300" />
        <StatCard label="Workout Plans" value={`${metrics.workoutPlans}`} />
        <StatCard label="Pending Reviews" value={`${metrics.pendingReviews}`} accent="text-yellow-300" />
      </section>

      <Card title="Quick Actions" className="mb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <Link href="/trainer/workouts" className="lf-item text-sm font-medium text-green-200">
            Create Workout Plan
          </Link>
          <Link
            href="/trainer/notifications"
            className="lf-item text-sm font-medium text-indigo-200"
          >
            Send Notification
          </Link>
          <Link
            href="/trainer/attendance"
            className="lf-item text-sm font-medium text-yellow-200"
          >
            View Attendance
          </Link>
        </div>
      </Card>

      <Card title="Assigned Members">
        {members.length === 0 ? (
          <EmptyState title="No members assigned yet" message="Ask admin to assign members to your profile." />
        ) : (
          <div className="space-y-2">
            {members.slice(0, 8).map((member) => (
              <article key={member.id} className="lf-item">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--lf-text)]">{member.displayName || 'Unnamed Member'}</p>
                    <p className="text-xs text-[var(--lf-text-soft)]">
                      {member.email || 'No email'} • {member.membershipStatus || 'active'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                      member.lastAttendanceDate === new Date().toISOString().slice(0, 10)
                        ? 'border border-green-500/60 bg-green-500/10 text-green-200'
                        : 'border border-yellow-500/60 bg-yellow-500/10 text-yellow-200'
                    }`}
                  >
                    {member.lastAttendanceDate === new Date().toISOString().slice(0, 10) ? 'Present' : 'Absent'}
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
