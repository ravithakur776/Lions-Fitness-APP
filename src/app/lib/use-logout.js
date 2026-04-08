'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/src/app/lib/auth'
import { auth } from '@/src/app/lib/firebase'

export function useLogout() {
  const router = useRouter()

  return async function logout() {
    if (auth) {
      await signOut(auth)
    }
    router.replace('/login')
  }
}
