import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function isLikelyPlaceholder(value) {
  const input = String(value || '').trim().toLowerCase()
  if (!input) return true

  const placeholderTokens = [
    'your_',
    'your-',
    'yourproject',
    'placeholder',
    'example',
    'changeme',
    'replace_me',
    'dummy',
  ]

  if (placeholderTokens.some((token) => input.includes(token))) return true
  if (input.endsWith('_here')) return true
  if (input === 'your_project_id') return true
  if (input === 'your_api_key_here') return true

  return false
}

const hasAllKeys = Object.values(firebaseConfig).every(Boolean)
const hasRealValues = Object.values(firebaseConfig).every((value) => !isLikelyPlaceholder(value))

export const isFirebaseConfigured = hasAllKeys && hasRealValues
export const isDemoMode = String(process.env.NEXT_PUBLIC_DEMO_MODE || 'false').trim().toLowerCase() === 'true'

const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null

if (!isFirebaseConfigured && process.env.NODE_ENV !== 'production') {
  console.warn('Firebase env vars are missing or placeholders. Add real NEXT_PUBLIC_FIREBASE_* values in .env.local')
}

export const auth = app ? getAuth(app) : isDemoMode ? { __demo: true } : null
export const db = app ? getFirestore(app) : isDemoMode ? { __demo: true } : null
export default app
