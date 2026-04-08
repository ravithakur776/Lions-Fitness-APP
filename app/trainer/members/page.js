'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { TRAINER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

export default function TrainerMembersPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.TRAINER)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadMembers = useCallback(async (uid) => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER), where('trainerId', '==', uid))
      )
      setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load members.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadMembers(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadMembers, user])

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading members..." />
  }

  return (
    <RoleLayout
      title="My Members"
      subtitle="View assigned member profiles"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={TRAINER_NAV}
      currentPath="/trainer/members"
      maxWidth="max-w-6xl"
    >
      {(error || status.message) && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || status.message}
        </div>
      )}

      <Card title="Assigned Members">
        {members.length === 0 ? (
          <EmptyState title="No members assigned yet" message="Once admin assigns members, they will appear here." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {members.map((member) => (
              <article key={member.id} className="lf-item p-4">
                <p className="font-semibold text-orange-300">{member.displayName || 'Unnamed Member'}</p>
                <p className="text-xs text-[var(--lf-text-soft)]">{member.email || 'No email'}</p>
                <p className="mt-1 text-xs text-[var(--lf-text-soft)]">Goal: {member.fitnessGoal || 'Not set'}</p>
                <p className="text-xs text-[var(--lf-text-soft)]">
                  Plan: {member.membershipPlanName || member.membershipStatus || 'active'}
                </p>

                <div className="mt-3 flex gap-2">
                  <Link href="/trainer/workouts" className="lf-btn-ghost text-xs">
                    Assign Workout
                  </Link>
                  <Link href="/trainer/notifications" className="lf-btn-ghost text-xs">
                    Send Message
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}
