'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { todayISODate } from '@/src/app/lib/format'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { PageLoader } from '@/src/app/components/ui-states'

export default function MemberAttendancePage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()
  const [status, setStatus] = useState({ type: '', message: '' })
  const [attendanceDates, setAttendanceDates] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !db) return
    loadAttendance(user.uid)
  }, [user])

  const loadAttendance = async (uid) => {
    try {
      const snapshot = await getDocs(query(collection(db, 'users', uid, 'attendance'), orderBy('date', 'desc')))
      setAttendanceDates(snapshot.docs.map((item) => item.data().date).filter(Boolean))
    } catch {
      setStatus({ type: 'error', message: 'Could not load attendance records.' })
    }
  }

  const today = todayISODate()
  const checkedInToday = attendanceDates.includes(today)

  const monthStats = useMemo(() => {
    const now = new Date()
    const monthKey = now.toISOString().slice(0, 7)
    const totalDaysPassed = now.getDate()

    const attended = attendanceDates.filter((item) => String(item).startsWith(monthKey)).length
    const rate = totalDaysPassed > 0 ? Math.round((attended / totalDaysPassed) * 100) : 0

    return { attended, rate }
  }, [attendanceDates])

  const streak = useMemo(() => calculateStreak(attendanceDates), [attendanceDates])

  const calendar = useMemo(() => buildMonthCalendar(new Date(), new Set(attendanceDates), today), [attendanceDates, today])

  const handleCheckIn = async () => {
    if (!user || !db || checkedInToday) return

    try {
      setSaving(true)
      const timestamp = new Date().toISOString()
      await Promise.all([
        setDoc(doc(db, 'users', user.uid, 'attendance', today), {
          date: today,
          status: 'present',
          createdAt: timestamp,
        }),
        updateDoc(doc(db, 'users', user.uid), {
          lastAttendanceDate: today,
          updatedAt: timestamp,
        }),
      ])
      setStatus({ type: 'success', message: 'Check-in successful for today.' })
      await loadAttendance(user.uid)
    } catch {
      setStatus({ type: 'error', message: 'Could not check in. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading attendance..." />
  }

  return (
    <RoleLayout
      title="Attendance"
      subtitle="Check-in and monthly consistency"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/attendance"
      maxWidth="max-w-5xl"
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

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <StatCard label="Day Streak" value={`${streak}`} accent="text-yellow-300" />
        <StatCard label="Days This Month" value={`${monthStats.attended}`} />
        <StatCard label="Attendance Rate" value={`${monthStats.rate}%`} accent="text-green-300" />
      </section>

      <Card title="This Month Calendar" className="mb-4">
        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs text-[var(--lf-text-soft)]">
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendar.map((day, index) => (
            <div
              key={`${day.date}-${index}`}
              className={`flex h-9 items-center justify-center rounded-lg text-xs ${
                day.state === 'present'
                  ? 'border border-green-500/45 bg-green-500/15 text-green-200'
                  : day.state === 'today'
                    ? 'bg-[var(--lf-accent)] text-white'
                    : day.state === 'future'
                      ? 'border border-[var(--lf-border)] bg-[var(--lf-surface)] text-[var(--lf-text-soft)]/45'
                      : day.state === 'blank'
                        ? 'bg-transparent'
                        : 'border border-[var(--lf-border)] bg-[var(--lf-surface-soft)] text-[var(--lf-text-soft)]'
              }`}
            >
              {day.label}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--lf-text-soft)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-green-500/60 bg-green-500/15" />
            Present
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-[var(--lf-border)] bg-[var(--lf-surface-soft)]" />
            Absent
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[var(--lf-accent)]" />
            Today
          </span>
        </div>
      </Card>

      <button
        type="button"
        onClick={handleCheckIn}
        disabled={saving || checkedInToday}
        className={`w-full ${checkedInToday ? 'lf-btn-ghost text-green-200' : 'lf-btn-primary'}`}
      >
        {checkedInToday ? 'Already checked in today' : saving ? 'Checking in...' : 'Check in for today'}
      </button>
    </RoleLayout>
  )
}

function calculateStreak(dateList) {
  const uniqueDates = [...new Set(dateList)].sort((a, b) => (a > b ? -1 : 1))
  if (uniqueDates.length === 0) return 0

  let streak = 0
  let current = new Date(todayISODate())

  for (const dateString of uniqueDates) {
    const value = new Date(dateString)
    const valueISO = value.toISOString().slice(0, 10)
    const currentISO = current.toISOString().slice(0, 10)

    if (valueISO === currentISO) {
      streak += 1
      current.setDate(current.getDate() - 1)
      continue
    }

    break
  }

  return streak
}

function buildMonthCalendar(monthDate, attendanceSet, todayIso) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days = []

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push({ date: `blank-${i}`, label: '', state: 'blank' })
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day)
    const iso = date.toISOString().slice(0, 10)

    let state = 'absent'

    if (attendanceSet.has(iso)) {
      state = 'present'
    } else if (iso === todayIso) {
      state = 'today'
    } else if (iso > todayIso) {
      state = 'future'
    }

    days.push({ date: iso, label: String(day), state })
  }

  return days
}
