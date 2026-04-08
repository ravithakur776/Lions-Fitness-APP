'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from '@/src/app/lib/auth'
import { auth, isFirebaseConfigured } from '@/src/app/lib/firebase'
import { ensureUserProfile } from '@/src/app/lib/user-profile'
import { getDashboardPathByRole, isOwnerEmail, isOwnerOnlyMode } from '@/src/app/lib/roles'
import { PageLoader } from '@/src/app/components/ui-states'

export default function DashboardRouterPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isFirebaseConfigured) {
      router.replace('/login')
      return () => {}
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      if (isOwnerOnlyMode() && !isOwnerEmail(user.email)) {
        await signOut(auth)
        router.replace('/login')
        return
      }

      try {
        const profile = await ensureUserProfile(user)
        router.replace(getDashboardPathByRole(profile?.role))
      } catch {
        router.replace('/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  return (
    <PageLoader label="Redirecting to your dashboard..." />
  )
}
