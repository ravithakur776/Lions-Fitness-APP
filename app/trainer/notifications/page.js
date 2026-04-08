'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, getDocs, orderBy, query, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate } from '@/src/app/lib/format'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  target: 'all',
  title: '',
  message: '',
  severity: 'medium',
}

export default function TrainerNotificationsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    if (!user || !db) return

    loadData(user.uid)
  }, [user])

  const loadData = async (uid) => {
    try {
      const [memberSnap, messageSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))),
        getDocs(query(collection(db, 'notifications'), where('createdBy', '==', uid), orderBy('createdAt', 'desc'))),
      ])

      setMembers(memberSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
      setMessages(messageSnap.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load notifications data.' })
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!user || !db) return

    if (!form.title.trim() || !form.message.trim()) {
      setStatus({ type: 'error', message: 'Title and message are required.' })
      return
    }

    try {
      setSaving(true)

      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        severity: form.severity,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      }

      if (form.target === 'all') {
        payload.targetRole = 'member'
      } else {
        payload.targetUserId = form.target
      }

      await addDoc(collection(db, 'notifications'), payload)

      setStatus({ type: 'success', message: 'Notification sent successfully.' })
      setForm(initialForm)
      await loadData(user.uid)
    } catch {
      setStatus({ type: 'error', message: 'Could not send notification.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading notifications panel..." />
  }

  return (
    <RoleLayout
      title="Send Notifications"
      subtitle="Message one member or all assigned members"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/notifications"
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
        <Card title="Compose Message">
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              name="target"
              value={form.target}
              onChange={handleChange}
              className="lf-field"
            >
              <option value="all">All Assigned Members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.email}
                </option>
              ))}
            </select>

            <input
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Workout Reminder"
              className="lf-field"
            />

            <textarea
              name="message"
              rows="4"
              value={form.message}
              onChange={handleChange}
              placeholder="Don't skip your workout tomorrow."
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
              {saving ? 'Sending...' : 'Send Notification'}
            </button>
          </form>
        </Card>

        <Card title="Sent Messages">
          {messages.length === 0 ? (
            <EmptyState title="No messages sent yet" message="Send your first message to motivate your members." />
          ) : (
            <div className="space-y-2">
              {messages.slice(0, 10).map((item) => (
                <article key={item.id} className="lf-item">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-orange-300">{item.title}</p>
                    <span className="text-[10px] uppercase text-[var(--lf-text-soft)]">
                      {item.targetUserId ? 'single' : 'all'}
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
