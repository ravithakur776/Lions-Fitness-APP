'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDocs, updateDoc, where, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { isConfiguredAdminEmail, normalizeRole, USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  userId: '',
  role: USER_ROLES.TRAINER,
  specialization: '',
}

export default function AdminTrainersPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [users, setUsers] = useState([])
  const [trainers, setTrainers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [usersSnap, trainersSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.TRAINER))),
      ])

      const userRows = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      setUsers(userRows)
      setTrainers(trainersSnap.docs.map((item) => ({ id: item.id, ...item.data() })))

      const assignableUsers = userRows.filter(
        (item) => !isConfiguredAdminEmail(item.email) && normalizeRole(item.role) !== USER_ROLES.ADMIN
      )

      setForm((prev) => {
        if (prev.userId || assignableUsers.length === 0) return prev
        return { ...prev, userId: assignableUsers[0].id }
      })
    } catch {
      setStatus({ type: 'error', message: 'Could not load trainer management data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    loadData()
  }, [loadData, user])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!form.userId || !db) return

    const selectedUser = users.find((item) => item.id === form.userId)
    if (selectedUser && isConfiguredAdminEmail(selectedUser.email)) {
      setStatus({ type: 'error', message: 'Primary admin account is locked and cannot be modified here.' })
      return
    }

    try {
      setSaving(true)
      await updateDoc(doc(db, 'users', form.userId), {
        role: form.role === USER_ROLES.TRAINER ? USER_ROLES.TRAINER : USER_ROLES.MEMBER,
        specialization: form.specialization,
        updatedAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'User role updated successfully.' })
      await loadData()
    } catch {
      setStatus({ type: 'error', message: 'Could not update role.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading trainer management..." />
  }

  const assignableUsers = users.filter(
    (item) => !isConfiguredAdminEmail(item.email) && normalizeRole(item.role) !== USER_ROLES.ADMIN
  )

  return (
    <RoleLayout
      title="Manage Trainers"
      subtitle="Assign trainer roles and specializations"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/trainers"
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
        <Card title="Role Assignment">
          {assignableUsers.length === 0 ? (
            <EmptyState
              title="No editable users available"
              message="Primary admin is locked. Create member accounts first, then promote selected users to trainer."
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <select
                name="userId"
                value={form.userId}
                onChange={handleChange}
                className="lf-field"
              >
                {assignableUsers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName || item.email} ({item.role || 'member'})
                  </option>
                ))}
              </select>

              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="lf-field"
              >
                <option value={USER_ROLES.MEMBER}>Member</option>
                <option value={USER_ROLES.TRAINER}>Trainer</option>
              </select>

              <input
                name="specialization"
                type="text"
                value={form.specialization}
                onChange={handleChange}
                placeholder="Strength / Cardio / Yoga"
                className="lf-field"
              />

              <button
                type="submit"
                disabled={saving}
                className="lf-btn-primary"
              >
                {saving ? 'Saving...' : 'Update Role'}
              </button>
            </form>
          )}
        </Card>

        <Card title="Current Trainers">
          {trainers.length === 0 ? (
            <EmptyState title="No trainers yet" message="Promote users to trainer role to manage coaching operations." />
          ) : (
            <div className="space-y-2">
              {trainers.map((trainer) => (
                <article key={trainer.id} className="lf-item">
                  <p className="font-semibold text-orange-300">{trainer.displayName || 'Unnamed Trainer'}</p>
                  <p className="text-xs text-[var(--lf-text-soft)]">
                    {trainer.email || 'No email'} • {trainer.specialization || 'General'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  )
}
