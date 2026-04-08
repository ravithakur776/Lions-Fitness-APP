'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, updateDoc, where, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { addDaysToISODate, getDaysUntil } from '@/src/app/lib/membership'
import { todayISODate } from '@/src/app/lib/format'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialEditor = {
  memberId: '',
  membershipStatus: 'active',
  membershipPlanName: 'Basic',
  trainerId: '',
  fitnessGoal: '',
  membershipExpiresAt: '',
}

export default function AdminMembersPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [trainers, setTrainers] = useState([])
  const [plans, setPlans] = useState([])
  const [editor, setEditor] = useState(initialEditor)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [membersSnap, trainersSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER))),
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.TRAINER))),
        getDocs(collection(db, 'membershipPlans')),
      ])

      const memberRows = membersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      const trainerRows = trainersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      const planRows = plansSnap.docs.map((item) => ({ id: item.id, ...item.data() }))

      setMembers(memberRows)
      setTrainers(trainerRows)
      setPlans(planRows)

      setEditor((prev) => {
        if (prev.memberId || memberRows.length === 0) return prev

        const first = memberRows[0]
        return {
          memberId: first.id,
          membershipStatus: first.membershipStatus || 'active',
          membershipPlanName: first.membershipPlanName || 'Basic',
          trainerId: first.trainerId || '',
          fitnessGoal: first.fitnessGoal || '',
          membershipExpiresAt: first.membershipExpiresAt || '',
        }
      })
    } catch {
      setStatus({ type: 'error', message: 'Could not load members data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    loadData()
  }, [loadData, user])

  const selectedMember = useMemo(
    () => members.find((item) => item.id === editor.memberId),
    [editor.memberId, members]
  )

  const handleChange = (event) => {
    const { name, value } = event.target

    if (name === 'memberId') {
      const member = members.find((item) => item.id === value)
      setEditor({
        memberId: value,
        membershipStatus: member?.membershipStatus || 'active',
        membershipPlanName: member?.membershipPlanName || 'Basic',
        trainerId: member?.trainerId || '',
        fitnessGoal: member?.fitnessGoal || '',
        membershipExpiresAt: member?.membershipExpiresAt || '',
      })
      return
    }

    setEditor((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!editor.memberId || !db) return

    try {
      setSaving(true)
      const selectedPlan = plans.find((item) => item.name === editor.membershipPlanName)
      const currentMember = members.find((item) => item.id === editor.memberId)
      const isPlanChanged = currentMember?.membershipPlanName !== editor.membershipPlanName

      const startDate = isPlanChanged ? todayISODate() : currentMember?.membershipStartedAt || todayISODate()
      const durationDays = Number(selectedPlan?.durationDays || 30)
      const expiresAt = isPlanChanged
        ? addDaysToISODate(startDate, durationDays)
        : currentMember?.membershipExpiresAt || addDaysToISODate(startDate, durationDays)

      await updateDoc(doc(db, 'users', editor.memberId), {
        membershipStatus: editor.membershipStatus,
        membershipPlanName: editor.membershipPlanName,
        membershipStartedAt: startDate,
        membershipExpiresAt: expiresAt,
        trainerId: editor.trainerId || null,
        fitnessGoal: editor.fitnessGoal,
        updatedAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Member updated successfully.' })
      await loadData()
    } catch {
      setStatus({ type: 'error', message: 'Could not update member.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading member management..." />
  }

  return (
    <RoleLayout
      title="Manage Members"
      subtitle="Update membership plan, trainer, and status"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/members"
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
        <Card title="Member Editor">
          <form onSubmit={handleSave} className="space-y-3">
            <select
              name="memberId"
              value={editor.memberId}
              onChange={handleChange}
              className="lf-field"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.email}
                </option>
              ))}
            </select>

            <select
              name="membershipStatus"
              value={editor.membershipStatus}
              onChange={handleChange}
              className="lf-field"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>

            <select
              name="membershipPlanName"
              value={editor.membershipPlanName}
              onChange={handleChange}
              className="lf-field"
            >
              {[...new Set(['Basic', 'Premium', 'Elite', ...plans.map((item) => item.name)])].map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>

            <select
              name="trainerId"
              value={editor.trainerId || ''}
              onChange={handleChange}
              className="lf-field"
            >
              <option value="">No trainer assigned</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.displayName || trainer.email}
                </option>
              ))}
            </select>

            <input
              name="fitnessGoal"
              type="text"
              value={editor.fitnessGoal}
              onChange={handleChange}
              placeholder="Fitness goal"
              className="lf-field"
            />

            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Save Member'}
            </button>
          </form>
        </Card>

        <Card title="Selected Member Overview">
          {!selectedMember ? (
            <EmptyState title="No member selected" message="Select a member from the editor to view profile data." />
          ) : (
            <div className="space-y-2 text-sm text-[var(--lf-text-soft)]">
              <p>
                <span className="text-[var(--lf-text)]">Name:</span> {selectedMember.displayName || 'Unnamed'}
              </p>
              <p>
                <span className="text-[var(--lf-text)]">Email:</span> {selectedMember.email || '-'}
              </p>
              <p>
                <span className="text-[var(--lf-text)]">Status:</span> {selectedMember.membershipStatus || 'active'}
              </p>
              <p>
                <span className="text-[var(--lf-text)]">Plan:</span> {selectedMember.membershipPlanName || 'Basic'}
              </p>
              <p>
                <span className="text-[var(--lf-text)]">Expires:</span> {selectedMember.membershipExpiresAt || '-'}
                {selectedMember.membershipExpiresAt ? ` (${Math.max(getDaysUntil(selectedMember.membershipExpiresAt), 0)} days left)` : ''}
              </p>
              <p>
                <span className="text-[var(--lf-text)]">Trainer:</span> {selectedMember.trainerId || 'none'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  )
}
