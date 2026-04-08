'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate, todayISODate } from '@/src/app/lib/format'
import { getDaysUntil, getDerivedMembershipStatus } from '@/src/app/lib/membership'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialWorkout = {
  date: todayISODate(),
  type: '',
  duration: '',
  calories: '',
  notes: '',
}

export default function MemberDashboardPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()

  const [workouts, setWorkouts] = useState([])
  const [workout, setWorkout] = useState(initialWorkout)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [monthAttendance, setMonthAttendance] = useState(0)
  const [latestWeight, setLatestWeight] = useState('-')
  const [nextPaymentDate, setNextPaymentDate] = useState('-')
  const [streak, setStreak] = useState(0)
  const [todayPlan, setTodayPlan] = useState(null)
  const [planUpdatingIndex, setPlanUpdatingIndex] = useState(-1)

  useEffect(() => {
    if (!user || !db) return

    loadData(user.uid)
  }, [user])

  const loadData = async (uid) => {
    try {
      const workoutsPromise = getDocs(query(collection(db, 'users', uid, 'workouts'), orderBy('date', 'desc')))
      const attendancePromise = getDocs(query(collection(db, 'users', uid, 'attendance'), orderBy('date', 'desc')))
      const progressPromise = getDocs(
        query(collection(db, 'users', uid, 'progress'), orderBy('date', 'desc'), limit(6))
      )
      const paymentsPromise = getDocs(
        query(collection(db, 'users', uid, 'payments'), orderBy('dueDate', 'asc'), limit(8))
      )
      const planPromise = getDocs(
        query(collection(db, 'workoutPlans'), where('assignedTo', '==', uid), orderBy('createdAt', 'desc'), limit(1))
      )

      const [workoutsSnap, attendanceSnap, progressSnap, paymentsSnap, planSnap] = await Promise.all([
        workoutsPromise,
        attendancePromise,
        progressPromise,
        paymentsPromise,
        planPromise,
      ])

      const workoutRows = workoutsSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      setWorkouts(workoutRows)

      const attendanceRows = attendanceSnap.docs.map((item) => item.data())
      const monthKey = new Date().toISOString().slice(0, 7)
      const attendedThisMonth = attendanceRows.filter((item) => String(item.date || '').startsWith(monthKey)).length
      setMonthAttendance(attendedThisMonth)
      setStreak(calculateStreak(attendanceRows.map((item) => item.date).filter(Boolean)))

      const progressRows = progressSnap.docs.map((item) => item.data())
      setLatestWeight(progressRows[0]?.weight ? `${progressRows[0].weight} kg` : '-')

      const paymentRows = paymentsSnap.docs.map((item) => item.data())
      const pendingPayment = paymentRows.find((item) => item.status !== 'paid')
      setNextPaymentDate(pendingPayment?.dueDate ? formatDate(pendingPayment.dueDate) : '-')

      setTodayPlan(planSnap.empty ? null : { id: planSnap.docs[0].id, ...planSnap.docs[0].data() })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not load your dashboard data. Please check Firestore rules.',
      })
    }
  }

  const summary = useMemo(() => {
    return workouts.reduce(
      (acc, item) => {
        acc.totalWorkouts += 1
        acc.totalMinutes += Number(item.duration || 0)
        acc.totalCalories += Number(item.calories || 0)
        return acc
      },
      { totalWorkouts: 0, totalMinutes: 0, totalCalories: 0 }
    )
  }, [workouts])

  const todayWorkoutProgress = useMemo(() => {
    if (!todayPlan || !Array.isArray(todayPlan.exercises) || todayPlan.exercises.length === 0) {
      return { done: 0, total: 0, percent: 0 }
    }

    const doneCount = todayPlan.exercises.filter((item) => item.completed).length
    const total = todayPlan.exercises.length
    const percent = Math.round((doneCount / total) * 100)

    return { done: doneCount, total, percent }
  }, [todayPlan])

  const membershipStatus = getDerivedMembershipStatus(profile?.membershipStatus, profile?.membershipExpiresAt)
  const daysLeft = getDaysUntil(profile?.membershipExpiresAt)

  const handleWorkoutChange = (event) => {
    const { name, value } = event.target
    setWorkout((prev) => ({ ...prev, [name]: value }))
  }

  const handleWorkoutSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!user || !db) {
      setStatus({ type: 'error', message: 'You must be logged in to add workouts.' })
      return
    }

    if (!workout.date || !workout.type.trim() || !workout.duration) {
      setStatus({ type: 'error', message: 'Date, workout type, and duration are required.' })
      return
    }

    try {
      setSaving(true)
      await addDoc(collection(db, 'users', user.uid, 'workouts'), {
        date: workout.date,
        type: workout.type.trim(),
        duration: Number(workout.duration),
        calories: Number(workout.calories || 0),
        notes: workout.notes.trim(),
        createdAt: new Date().toISOString(),
      })

      setWorkout({ ...initialWorkout, date: todayISODate() })
      setStatus({ type: 'success', message: 'Workout logged successfully.' })
      await loadData(user.uid)
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not save workout. Check your Firebase permissions and try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleExercise = async (index) => {
    if (!todayPlan?.id || !Array.isArray(todayPlan.exercises) || !db) return

    const nextExercises = todayPlan.exercises.map((item, itemIndex) =>
      itemIndex === index ? { ...item, completed: !item.completed } : item
    )

    try {
      setPlanUpdatingIndex(index)
      await updateDoc(doc(db, 'workoutPlans', todayPlan.id), {
        exercises: nextExercises,
        updatedAt: new Date().toISOString(),
      })
      setTodayPlan((prev) => (prev ? { ...prev, exercises: nextExercises } : prev))
    } catch {
      setStatus({ type: 'error', message: 'Could not update exercise completion right now.' })
    } finally {
      setPlanUpdatingIndex(-1)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading member dashboard..." />
  }

  return (
    <RoleLayout
      title="Member Dashboard"
      subtitle="Your personal fitness hub"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/dashboard"
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

      <section className="lf-card-soft mb-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.12em] text-[var(--lf-accent-soft)]">MEMBERSHIP STATUS</p>
            <p className="text-lg font-medium text-[var(--lf-text)]">{profile?.membershipPlanName || 'Premium Plan'}</p>
            <p className="text-xs text-[var(--lf-text-soft)]">
              Expires: {profile?.membershipExpiresAt ? formatDate(profile.membershipExpiresAt) : '-'}
              {typeof daysLeft === 'number' ? ` • ${daysLeft >= 0 ? `${daysLeft} days left` : 'expired'}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-[var(--lf-accent)] px-3 py-1 text-[10px] font-medium uppercase text-white">
            {membershipStatus}
          </span>
        </div>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="Attendance" value={`${monthAttendance} days`} />
        <StatCard label="Weight" value={latestWeight} />
        <StatCard label="Next Payment" value={nextPaymentDate} accent="text-yellow-300" />
        <StatCard label="Streak" value={`${streak} days`} />
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <StatCard label="Total Workouts" value={summary.totalWorkouts} />
        <StatCard label="Total Minutes" value={summary.totalMinutes} />
        <StatCard label="Total Calories" value={summary.totalCalories} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Today's Workout">
          {!todayPlan ? (
            <EmptyState
              title="No workout assigned yet"
              message="Your trainer can assign a plan from the Trainer dashboard."
            />
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-[var(--lf-text)]">{todayPlan.title || 'Assigned Plan'}</p>
              <p className="mb-2 text-xs text-[var(--lf-text-soft)]">Tap any exercise to mark it complete.</p>
              <div className="space-y-2">
                {(todayPlan.exercises || []).map((exercise, index) => (
                  <button
                    key={`${exercise.name}-${index}`}
                    type="button"
                    onClick={() => handleToggleExercise(index)}
                    disabled={planUpdatingIndex === index}
                    className={`lf-item w-full text-left transition ${
                      exercise.completed
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'hover:border-[var(--lf-border-soft)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                          exercise.completed
                            ? 'border-green-500/60 bg-green-500/20 text-green-200'
                            : 'border-[var(--lf-border)] text-[var(--lf-text-soft)]'
                        }`}
                      >
                        {exercise.completed ? '✓' : ''}
                      </span>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            exercise.completed ? 'text-green-200 line-through decoration-2' : 'text-[var(--lf-text)]'
                          }`}
                        >
                          {exercise.name}
                        </p>
                        <p className="text-xs text-[var(--lf-text-soft)]">
                          {exercise.sets} sets × {exercise.reps} reps
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-[var(--lf-text-soft)]">
                  <span>Progress</span>
                  <span>
                    {todayWorkoutProgress.done}/{todayWorkoutProgress.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--lf-border)]">
                  <div className="h-1.5 rounded-full bg-[var(--lf-accent)]" style={{ width: `${todayWorkoutProgress.percent}%` }} />
                </div>
              </div>
            </>
          )}
        </Card>

        <Card title="Quick Log Workout">
          <form onSubmit={handleWorkoutSubmit} className="space-y-3">
            <input
              name="date"
              type="date"
              value={workout.date}
              onChange={handleWorkoutChange}
              className="lf-field"
            />
            <input
              name="type"
              type="text"
              value={workout.type}
              onChange={handleWorkoutChange}
              placeholder="Workout type"
              className="lf-field"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="duration"
                type="number"
                min="1"
                value={workout.duration}
                onChange={handleWorkoutChange}
                placeholder="Minutes"
                className="lf-field"
              />
              <input
                name="calories"
                type="number"
                min="0"
                value={workout.calories}
                onChange={handleWorkoutChange}
                placeholder="Calories"
                className="lf-field"
              />
            </div>
            <textarea
              name="notes"
              rows="2"
              value={workout.notes}
              onChange={handleWorkoutChange}
              placeholder="Notes"
              className="lf-field"
            />
            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Log Workout'}
            </button>
          </form>
        </Card>
      </div>

      <Card title="Recent Workout Logs" className="mt-4">
        {workouts.length === 0 ? (
          <EmptyState title="No workout logs yet" message="Start logging workouts to build your activity history." />
        ) : (
          <div className="space-y-2">
            {workouts.slice(0, 8).map((item) => (
              <article key={item.id} className="lf-item">
                <p className="font-semibold text-[var(--lf-text)]">{item.type || 'Workout'}</p>
                <p className="text-xs text-[var(--lf-text-soft)]">
                  {formatDate(item.date)} • {item.duration || 0} min • {item.calories || 0} kcal
                </p>
                {item.notes && <p className="mt-1 text-xs text-[var(--lf-text-soft)]">{item.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </Card>
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
