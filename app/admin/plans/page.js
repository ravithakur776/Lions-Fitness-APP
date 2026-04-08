'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatCurrencyINR } from '@/src/app/lib/format'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  name: '',
  price: '',
  durationDays: '30',
  features: 'Gym Access\nLocker\nBasic Support',
}

export default function AdminPlansPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !db) return

    loadPlans()
  }, [user])

  const loadPlans = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'membershipPlans'), orderBy('createdAt', 'desc')))
      setPlans(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load plans.' })
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!form.name.trim() || !form.price) {
      setStatus({ type: 'error', message: 'Plan name and price are required.' })
      return
    }

    try {
      setSaving(true)
      await addDoc(collection(db, 'membershipPlans'), {
        name: form.name.trim(),
        price: Number(form.price),
        durationDays: Number(form.durationDays || 30),
        features: form.features
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        createdAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Plan created successfully.' })
      setForm(initialForm)
      await loadPlans()
    } catch {
      setStatus({ type: 'error', message: 'Could not create plan.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'membershipPlans', id))
      await loadPlans()
    } catch {
      setStatus({ type: 'error', message: 'Could not delete plan.' })
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading plans..." />
  }

  return (
    <RoleLayout
      title="Membership Plans"
      subtitle="Create and maintain gym plans"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/plans"
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
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Premium"
              className="lf-field"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={handleChange}
                placeholder="Price"
                className="lf-field"
              />
              <input
                name="durationDays"
                type="number"
                min="1"
                value={form.durationDays}
                onChange={handleChange}
                placeholder="Duration days"
                className="lf-field"
              />
            </div>
            <textarea
              name="features"
              rows="5"
              value={form.features}
              onChange={handleChange}
              className="lf-field"
            />
            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Create Plan'}
            </button>
          </form>
        </Card>

        <Card title="Existing Plans">
          {plans.length === 0 ? (
            <EmptyState title="No plans available" message="Create your first plan to assign it to gym members." />
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <article key={plan.id} className="lf-item">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-orange-300">{plan.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatCurrencyINR(plan.price)} • {plan.durationDays} days
                      </p>
                      <p className="mt-1 text-[11px] text-gray-300">{(plan.features || []).join(' • ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(plan.id)}
                      className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  )
}
