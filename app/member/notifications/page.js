'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate } from '@/src/app/lib/format'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function MemberNotificationsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()

  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadNotifications = useCallback(async (uid) => {
    try {
      const [notificationSnap, announcementSnap] = await Promise.all([
        getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))),
      ])

      const personal = notificationSnap.docs
        .map((item) => ({ id: item.id, type: 'notification', ...item.data() }))
        .filter((item) => item.targetUserId === uid || item.targetRole === 'member' || item.targetRole === 'all')

      const announcements = announcementSnap.docs.map((item) => ({
        id: item.id,
        type: 'announcement',
        title: item.data().title,
        message: item.data().message,
        createdAt: item.data().createdAt,
        severity: item.data().severity || 'info',
      }))

      const merged = [...personal, ...announcements].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      )

      setItems(merged)
    } catch {
      setStatus({ type: 'error', message: 'Could not load notifications.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadNotifications(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadNotifications, user])

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading notifications..." />
  }

  return (
    <RoleLayout
      title="Notifications"
      subtitle="Reminders, trainer messages, and gym alerts"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/notifications"
      maxWidth="max-w-5xl"
    >
      {(error || status.message) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || status.message}
        </div>
      )}

      <Card title="Inbox">
        {items.length === 0 ? (
          <EmptyState title="No notifications yet" message="Trainer messages and announcements will appear here." />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <article key={`${item.type}-${item.id}`} className="lf-item">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-orange-300">{item.title || 'Update'}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                      item.severity === 'high'
                        ? 'bg-red-500/20 text-red-200'
                        : item.severity === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-200'
                          : 'bg-blue-500/20 text-blue-200'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <p className="text-xs text-gray-300">{item.message || 'No content'}</p>
                <p className="mt-2 text-[10px] text-[var(--lf-text-soft)]">{formatDate(item.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}
