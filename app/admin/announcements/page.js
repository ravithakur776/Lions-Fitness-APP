'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, getDocs, orderBy, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate } from '@/src/app/lib/format'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  title: '',
  message: '',
  severity: 'medium',
}

export default function AdminAnnouncementsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [form, setForm] = useState(initialForm)
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !db) return

    loadItems()
  }, [user])

  const loadItems = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')))
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load announcements.' })
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!form.title.trim() || !form.message.trim()) {
      setStatus({ type: 'error', message: 'Title and message are required.' })
      return
    }

    try {
      setSaving(true)
      await addDoc(collection(db, 'announcements'), {
        title: form.title.trim(),
        message: form.message.trim(),
        severity: form.severity,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Announcement published.' })
      setForm(initialForm)
      await loadItems()
    } catch {
      setStatus({ type: 'error', message: 'Could not publish announcement.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading announcements..." />
  }

  return (
    <RoleLayout
      title="Announcements"
      subtitle="Publish gym-wide alerts"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/announcements"
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
        <Card title="Create Announcement">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Holiday Hours Update"
              className="lf-field"
            />

            <textarea
              name="message"
              rows="5"
              value={form.message}
              onChange={handleChange}
              placeholder="Gym will be closed on Sunday due to maintenance."
              className="lf-field"
            />

            <select
              name="severity"
              value={form.severity}
              onChange={handleChange}
              className="lf-field"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </form>
        </Card>

        <Card title="Recent Announcements">
          {items.length === 0 ? (
            <EmptyState title="No announcements yet" message="Publish your first gym-wide message from this panel." />
          ) : (
            <div className="space-y-2">
              {items.slice(0, 10).map((item) => (
                <article key={item.id} className="lf-item">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-orange-300">{item.title}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                        item.severity === 'high'
                          ? 'bg-red-500/20 text-red-200'
                          : item.severity === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-200'
                            : 'bg-blue-500/20 text-blue-200'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--lf-text)]">{item.message}</p>
                  <p className="mt-2 text-[10px] text-[var(--lf-text-soft)]">{formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  )
}
