'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate } from '@/src/app/lib/format'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  title: '',
  memberId: '',
  exercisesText: 'Bench Press|4|10\nShoulder Press|3|12\nTricep Dips|3|15',
}

const ALL_MEMBERS_VALUE = '__all_members__'

export default function TrainerWorkoutsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async (uid) => {
    try {
      const [membersSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))),
        getDocs(query(collection(db, 'workoutPlans'), where('createdBy', '==', uid), orderBy('createdAt', 'desc'))),
      ])

      const memberRows = membersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      setMembers(memberRows)
      setPlans(plansSnap.docs.map((item) => ({ id: item.id, ...item.data() })))

      setForm((prev) => {
        if (prev.memberId || memberRows.length === 0) return prev
        return { ...prev, memberId: memberRows[0].id }
      })
    } catch {
      setStatus({ type: 'error', message: 'Could not load workout data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    loadData(user.uid)
  }, [loadData, user])

  const parsedExercises = useMemo(() => parseExercises(form.exercisesText), [form.exercisesText])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!user || !db) return

    if (!form.title.trim()) {
      setStatus({ type: 'error', message: 'Workout title is required.' })
      return
    }

    if (!form.memberId) {
      setStatus({ type: 'error', message: 'Select a member or all members.' })
      return
    }

    if (parsedExercises.length === 0) {
      setStatus({ type: 'error', message: 'Add at least one exercise line.' })
      return
    }

    try {
      setSaving(true)
      const targetMembers =
        form.memberId === ALL_MEMBERS_VALUE ? members : members.filter((item) => item.id === form.memberId)

      if (targetMembers.length === 0) {
        setStatus({ type: 'error', message: 'No valid members found for assignment.' })
        return
      }

      await Promise.all(
        targetMembers.map(async (member) => {
          const planRef = await addDoc(collection(db, 'workoutPlans'), {
            title: form.title.trim(),
            exercises: parsedExercises,
            assignedTo: member.id,
            assignedMemberName: member?.displayName || '',
            trainerId: user.uid,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
          })

          await updateDoc(doc(db, 'users', member.id), {
            assignedWorkoutPlanId: planRef.id,
            assignedWorkoutTitle: form.title.trim(),
            updatedAt: new Date().toISOString(),
          })

          return planRef.id
        })
      )

      setStatus({
        type: 'success',
        message:
          targetMembers.length === 1
            ? 'Workout plan created and assigned.'
            : `Workout plan assigned to ${targetMembers.length} members successfully.`,
      })
      setForm((prev) => ({ ...prev, title: '' }))
      await loadData(user.uid)
    } catch {
      setStatus({ type: 'error', message: 'Could not create workout plan.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading workout builder..." />
  }

  return (
    <RoleLayout
      title="Workout Builder"
      subtitle="Create and assign plans to members"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/workouts"
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Create Plan">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Push Day — Chest & Shoulders"
              className="lf-field"
            />

            <select
              name="memberId"
              value={form.memberId}
              onChange={handleChange}
              className="lf-field"
            >
              <option value={ALL_MEMBERS_VALUE}>All Assigned Members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.email}
                </option>
              ))}
            </select>

            <textarea
              name="exercisesText"
              rows="7"
              value={form.exercisesText}
              onChange={handleChange}
              className="lf-field"
            />

            <p className="text-xs text-gray-400">Format: Exercise|Sets|Reps (one per line)</p>

            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Assigning...' : 'Assign Plan'}
            </button>
          </form>
        </Card>

        <Card title="Exercise Preview">
          {parsedExercises.length === 0 ? (
            <EmptyState
              title="No exercises parsed yet"
              message="Use format: Exercise|Sets|Reps on each new line."
            />
          ) : (
            <div className="space-y-2">
              {parsedExercises.map((exercise, index) => (
                <article key={`${exercise.name}-${index}`} className="lf-item">
                  <p className="font-semibold text-orange-300">{exercise.name}</p>
                  <p className="text-xs text-gray-400">
                    {exercise.sets} sets × {exercise.reps} reps
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent Assigned Plans" className="mt-4">
        {plans.length === 0 ? (
          <EmptyState title="No plans created yet" message="Create your first workout plan from the form above." />
        ) : (
          <div className="space-y-2">
            {plans.slice(0, 8).map((plan) => (
              <article key={plan.id} className="lf-item">
                <p className="font-semibold text-orange-300">{plan.title || 'Untitled Plan'}</p>
                <p className="text-xs text-gray-400">
                  Member: {plan.assignedMemberName || plan.assignedTo} • Created: {formatDate(plan.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}

function parseExercises(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', sets = '0', reps = '0'] = line.split('|').map((part) => part.trim())
      return {
        name,
        sets: Number(sets || 0),
        reps: Number(reps || 0),
        completed: false,
      }
    })
    .filter((item) => item.name)
}
