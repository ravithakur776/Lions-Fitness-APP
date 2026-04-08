'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from '@/src/app/lib/auth'
import { auth, isFirebaseConfigured } from '@/src/app/lib/firebase'
import { ensureUserProfile } from '@/src/app/lib/user-profile'
import { getDashboardPathByRole, isOwnerEmail, isOwnerOnlyMode, normalizeRole } from '@/src/app/lib/roles'

export function useAuthRole(requiredRole) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add real keys in .env.local and restart.')
      setLoading(false)
      return () => {}
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLoading(false)
        router.replace('/login')
        return
      }

      if (isOwnerOnlyMode() && !isOwnerEmail(currentUser.email)) {
        await signOut(auth)
        setError('Access denied. Only owner email can use this app.')
        setLoading(false)
        router.replace('/login')
        return
      }

      try {
        const ensuredProfile = await ensureUserProfile(currentUser)
        const role = normalizeRole(ensuredProfile?.role)

        if (requiredRole && role !== requiredRole) {
          router.replace(getDashboardPathByRole(role))
          return
        }

        setUser(currentUser)
        setProfile(ensuredProfile)
      } catch {
        setError('Could not load your profile. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [requiredRole, router])

  return {
    loading,
    user,
    profile,
    error,
    firebaseReady: isFirebaseConfigured,
  }
}
