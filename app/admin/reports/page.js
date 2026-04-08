'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, updateDoc } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatCurrencyINR, todayISODate } from '@/src/app/lib/format'
import { getDaysUntil, getDerivedMembershipStatus } from '@/src/app/lib/membership'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function AdminReportsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [attendanceTotal, setAttendanceTotal] = useState(0)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [runningReminders, setRunningReminders] = useState(false)

  const loadReports = useCallback(async () => {
    try {
      const [userSnap, paymentSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'payments')),
      ])

      const userRows = userSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      setUsers(userRows)
      setPayments(paymentSnap.docs.map((item) => ({ id: item.id, ...item.data() })))

      const members = userRows.filter((item) => item.role === USER_ROLES.MEMBER)
      const attendanceCounts = await Promise.all(
        members.map(async (member) => {
          const snapshot = await getDocs(collection(db, 'users', member.id, 'attendance'))
          return snapshot.size
        })
      )

      setAttendanceTotal(attendanceCounts.reduce((sum, value) => sum + value, 0))
    } catch {
      setStatus({ type: 'error', message: 'Could not load reports.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadReports()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadReports, user])

  const summary = useMemo(() => {
    const members = users.filter((item) => item.role === USER_ROLES.MEMBER)
    const trainers = users.filter((item) => item.role === USER_ROLES.TRAINER)

    const revenue = payments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const pending = payments.filter((item) => item.status !== 'paid').length

    const avgAttendance = members.length > 0 ? Math.round(attendanceTotal / members.length) : 0

    return {
      members: members.length,
      trainers: trainers.length,
      revenue,
      pending,
      avgAttendance,
    }
  }, [attendanceTotal, payments, users])

  const runReminders = useCallback(async () => {
    if (!db || !user) return

    try {
      setRunningReminders(true)
      setStatus({ type: '', message: '' })

      const notificationsSnap = await getDocs(collection(db, 'notifications'))
      const existingKeys = new Set(
        notificationsSnap.docs.map((item) => item.data()?.reminderKey).filter(Boolean)
      )

      const notificationsToCreate = []
      const updates = []
      const today = todayISODate()
      const members = users.filter((item) => item.role === USER_ROLES.MEMBER)

      for (const member of members) {
        const derivedStatus = getDerivedMembershipStatus(member.membershipStatus, member.membershipExpiresAt)
        const daysLeft = getDaysUntil(member.membershipExpiresAt)

        if (derivedStatus === 'expired' && member.membershipStatus !== 'expired') {
          updates.push(
            updateDoc(doc(db, 'users', member.id), {
              membershipStatus: 'expired',
              updatedAt: new Date().toISOString(),
            })
          )
        }

        if (typeof daysLeft === 'number') {
          if (daysLeft >= 0 && daysLeft <= 7) {
            const key = `membership-expiry-${member.id}-${member.membershipExpiresAt}`
            if (!existingKeys.has(key)) {
              notificationsToCreate.push({
                reminderKey: key,
                targetUserId: member.id,
                title: 'Membership Renewal Reminder',
                message: `Your membership expires in ${daysLeft} day(s). Please renew to avoid interruption.`,
                severity: daysLeft <= 2 ? 'high' : 'medium',
                targetRole: 'member',
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
              })
              existingKeys.add(key)
            }
          }

          if (daysLeft < 0) {
            const key = `membership-expired-${member.id}-${member.membershipExpiresAt}`
            if (!existingKeys.has(key)) {
              notificationsToCreate.push({
                reminderKey: key,
                targetUserId: member.id,
                title: 'Membership Expired',
                message: 'Your membership has expired. Renew now to continue access.',
                severity: 'high',
                targetRole: 'member',
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
              })
              existingKeys.add(key)
            }
          }
        }
      }

      for (const payment of payments) {
        if (!payment.memberId || !payment.dueDate || payment.status === 'paid') continue
        if (String(payment.dueDate) >= today) continue

        if (payment.status !== 'overdue') {
          updates.push(
            updateDoc(doc(db, 'payments', payment.id), {
              status: 'overdue',
              updatedAt: new Date().toISOString(),
            }),
            updateDoc(doc(db, 'users', payment.memberId, 'payments', payment.id), {
              status: 'overdue',
              updatedAt: new Date().toISOString(),
            })
          )
        }

        const paymentKey = `payment-overdue-${payment.id}`
        if (!existingKeys.has(paymentKey)) {
          notificationsToCreate.push({
            reminderKey: paymentKey,
            targetUserId: payment.memberId,
            title: 'Payment Overdue',
            message: `Your payment for ${payment.planName || 'membership'} is overdue. Please clear dues as soon as possible.`,
            severity: 'high',
            targetRole: 'member',
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
          })
          existingKeys.add(paymentKey)
        }
      }

      await Promise.all([
        ...updates,
        ...notificationsToCreate.map((payload) => addDoc(collection(db, 'notifications'), payload)),
      ])

      setStatus({
        type: 'success',
        message: `Reminder run complete. ${notificationsToCreate.length} notifications generated.`,
      })
      await loadReports()
    } catch {
      setStatus({ type: 'error', message: 'Could not run reminder engine.' })
    } finally {
      setRunningReminders(false)
    }
  }, [loadReports, payments, user, users])

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading reports..." />
  }

  return (
    <RoleLayout
      title="Reports"
      subtitle="Revenue and attendance analytics"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/reports"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            (error || status.type === 'error')
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-green-500/30 bg-green-500/10 text-green-200'
          }`}
        >
          {error || status.message}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-5">
        <StatCard label="Members" value={`${summary.members}`} />
        <StatCard label="Trainers" value={`${summary.trainers}`} />
        <StatCard label="Revenue" value={formatCurrencyINR(summary.revenue)} accent="text-green-300" />
        <StatCard label="Pending Payments" value={`${summary.pending}`} accent="text-yellow-300" />
        <StatCard label="Avg Attendance" value={`${summary.avgAttendance}`} />
      </section>

      <Card title="Top Metrics Snapshot">
        {users.length === 0 && payments.length === 0 ? (
          <EmptyState
            title="No report data yet"
            message="As members, attendance, and payments are added, insights will appear automatically."
          />
        ) : (
          <ul className="space-y-2 text-sm text-[var(--lf-text-soft)]">
            <li className="lf-item">Total attendance logs across members: {attendanceTotal}</li>
            <li className="lf-item">Paid payments recorded: {payments.filter((item) => item.status === 'paid').length}</li>
            <li className="lf-item">Overdue payments: {payments.filter((item) => item.status === 'overdue').length}</li>
            <li className="lf-item">
              Members with active status: {users.filter((item) => item.role === 'member' && item.membershipStatus === 'active').length}
            </li>
          </ul>
        )}
      </Card>

      <Card title="Automation">
        <p className="mb-3 text-sm text-[var(--lf-text-soft)]">
          Run membership renewal and overdue payment reminders for members.
        </p>
        <button
          type="button"
          onClick={runReminders}
          disabled={runningReminders}
          className="lf-btn-primary max-w-[220px]"
        >
          {runningReminders ? 'Running...' : 'Run Reminders Now'}
        </button>
      </Card>
    </RoleLayout>
  )
}
