'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate } from '@/src/app/lib/format'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function TrainerProgressPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadProgress = useCallback(async (uid) => {
    try {
      const memberSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))
      )
      const members = memberSnap.docs.map((item) => ({ id: item.id, ...item.data() }))

      const enriched = await Promise.all(
        members.map(async (member) => {
          const progressSnap = await getDocs(
            query(collection(db, 'users', member.id, 'progress'), orderBy('date', 'desc'), limit(6))
          )

          const entries = progressSnap.docs.map((item) => item.data())
          const latest = entries[0]
          const oldest = entries[entries.length - 1]

          return {
            ...member,
            latest,
            change:
              latest && oldest ? Number((Number(oldest.weight || 0) - Number(latest.weight || 0)).toFixed(1)) : 0,
          }
        })
      )

      setRows(enriched)
    } catch {
      setStatus({ type: 'error', message: 'Could not load progress reports.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadProgress(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadProgress, user])

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading progress view..." />
  }

  return (
    <RoleLayout
      title="Progress View"
      subtitle="Monitor member body-metric trends"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/progress"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || status.message}
        </div>
      )}

      <Card title="Member Progress">
        {rows.length === 0 ? (
          <EmptyState title="No assigned members yet" message="Assign members to this trainer to view their progress trends." />
        ) : (
          <div className="space-y-2">
            {rows.map((member) => (
              <article key={member.id} className="lf-item">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-orange-300">{member.displayName || 'Unnamed Member'}</p>
                    {member.latest ? (
                      <p className="text-xs text-[var(--lf-text-soft)]">
                        Latest: {member.latest.weight || 0} kg on {formatDate(member.latest.date)}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--lf-text-soft)]">No progress entries yet.</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] uppercase ${
                      member.change >= 0 ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
                    }`}
                  >
                    {member.change >= 0 ? `-${member.change} kg` : `+${Math.abs(member.change)} kg`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}
