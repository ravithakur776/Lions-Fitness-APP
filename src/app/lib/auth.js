import {
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup as firebaseSignInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth'
import { auth as appAuth, isDemoMode } from '@/src/app/lib/firebase'
import { getOwnerEmail, isOwnerEmail, isOwnerOnlyMode } from '@/src/app/lib/roles'

const DEMO_USERS_KEY = 'lf_demo_auth_users_v1'
const DEMO_CURRENT_UID_KEY = 'lf_demo_auth_current_uid_v1'

const demoSubscribers = new Set()
const DEFAULT_DEMO_ADMIN_EMAIL = 'admin@lionsfitness.app'
const DEFAULT_DEMO_ADMIN_PASSWORD = 'Admin@12345'
const DEFAULT_DEMO_TRAINER_EMAIL = 'trainer@lionsfitness.app'
const DEFAULT_DEMO_TRAINER_PASSWORD = 'Trainer@12345'

function inBrowser() {
  return typeof window !== 'undefined'
}

function isDemoAuth() {
  return isDemoMode || Boolean(appAuth?.__demo)
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value
}

function makeAuthError(code, message) {
  const error = new Error(message || code)
  error.code = code
  return error
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function assertOwnerOnlyAccess(email) {
  if (!isOwnerOnlyMode()) return

  const normalizedEmail = normalizeEmail(email)
  if (isOwnerEmail(normalizedEmail)) return

  throw makeAuthError(
    'app/owner-only-access',
    `Access is restricted. Only ${getOwnerEmail()} is allowed to login.`
  )
}

function assertFirebaseAuthConfigured(authInstance) {
  if (isDemoAuth()) return
  if (authInstance) return
  throw makeAuthError(
    'app/firebase-not-configured',
    'Firebase is not configured. Add real NEXT_PUBLIC_FIREBASE_* values and restart.'
  )
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function readDemoUsers() {
  if (!inBrowser()) return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEMO_USERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDemoUsers(users) {
  if (!inBrowser()) return
  window.localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users))
}

function readCurrentUid() {
  if (!inBrowser()) return ''
  return window.localStorage.getItem(DEMO_CURRENT_UID_KEY) || ''
}

function writeCurrentUid(uid) {
  if (!inBrowser()) return

  if (uid) {
    window.localStorage.setItem(DEMO_CURRENT_UID_KEY, uid)
  } else {
    window.localStorage.removeItem(DEMO_CURRENT_UID_KEY)
  }
}

function toDemoAuthUser(user) {
  if (!user) return null

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
  }
}

function getCurrentDemoUser() {
  const uid = readCurrentUid()
  if (!uid) return null

  const user = readDemoUsers().find((item) => item.uid === uid)
  return toDemoAuthUser(user)
}

function syncDemoCurrentUser(authInstance, user) {
  if (authInstance && typeof authInstance === 'object') {
    authInstance.currentUser = user
  }
}

function notifyDemoAuthChange() {
  const currentUser = getCurrentDemoUser()
  syncDemoCurrentUser(appAuth, currentUser)
  demoSubscribers.forEach((callback) => callback(currentUser))
}

function parseEmailList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'))
}

function getDemoAdminEmail() {
  const configured = parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS)
  return configured[0] || DEFAULT_DEMO_ADMIN_EMAIL
}

function getDemoAdminPassword() {
  return String(process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_ADMIN_PASSWORD)
}

function getDemoTrainerEmails() {
  const configured = parseEmailList(process.env.NEXT_PUBLIC_TRAINER_EMAILS)
  return configured.length > 0 ? configured : [DEFAULT_DEMO_TRAINER_EMAIL]
}

function getDemoTrainerPassword() {
  return String(process.env.NEXT_PUBLIC_DEMO_TRAINER_PASSWORD || DEFAULT_DEMO_TRAINER_PASSWORD)
}

function ensureDemoAdminUser() {
  if (!inBrowser()) return

  const adminEmail = getDemoAdminEmail()
  if (!adminEmail) return

  const users = readDemoUsers()
  const now = new Date().toISOString()
  let changed = false

  const adminIndex = users.findIndex((item) => normalizeEmail(item.email) === adminEmail)
  if (adminIndex >= 0) {
    const targetPassword = getDemoAdminPassword()
    if (String(users[adminIndex].password || '') !== targetPassword) {
      users[adminIndex] = {
        ...users[adminIndex],
        password: targetPassword,
        displayName: users[adminIndex].displayName || 'Lions Fitness Admin',
      }
      changed = true
    }
  } else {
    users.push({
      uid: createUid(),
      email: adminEmail,
      password: getDemoAdminPassword(),
      displayName: 'Lions Fitness Admin',
      photoURL: '',
      createdAt: now,
    })
    changed = true
  }

  const trainerPassword = getDemoTrainerPassword()
  const trainerEmails = getDemoTrainerEmails().filter((email) => email !== adminEmail)
  trainerEmails.forEach((trainerEmail) => {
    const exists = users.some((item) => normalizeEmail(item.email) === trainerEmail)
    if (exists) return
    users.push({
      uid: createUid(),
      email: trainerEmail,
      password: trainerPassword,
      displayName: 'Lions Fitness Trainer',
      photoURL: '',
      createdAt: now,
    })
    changed = true
  })

  if (changed) {
    writeDemoUsers(users)
  }
}

function createUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export class GoogleAuthProvider extends FirebaseGoogleAuthProvider {}

export async function createUserWithEmailAndPassword(authInstance, email, password) {
  assertFirebaseAuthConfigured(authInstance)

  if (!isDemoAuth()) {
    assertOwnerOnlyAccess(email)
    return firebaseCreateUserWithEmailAndPassword(authInstance, email, password)
  }

  ensureDemoAdminUser()

  const normalizedEmail = normalizeEmail(email)
  assertOwnerOnlyAccess(normalizedEmail)
  const adminEmail = getDemoAdminEmail()

  if (!isEmailValid(normalizedEmail)) {
    throw makeAuthError('auth/invalid-email')
  }

  if (String(password || '').length < 6) {
    throw makeAuthError('auth/weak-password')
  }

  if (normalizedEmail === adminEmail) {
    throw makeAuthError('auth/email-already-in-use', 'This admin email is reserved. Use login instead.')
  }

  const users = readDemoUsers()
  if (users.some((item) => normalizeEmail(item.email) === normalizedEmail)) {
    throw makeAuthError('auth/email-already-in-use')
  }

  const newUser = {
    uid: createUid(),
    email: normalizedEmail,
    password: String(password),
    displayName: '',
    photoURL: '',
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)
  writeDemoUsers(users)
  writeCurrentUid(newUser.uid)

  const authUser = toDemoAuthUser(newUser)
  syncDemoCurrentUser(authInstance, authUser)
  notifyDemoAuthChange()

  return { user: authUser }
}

export async function signInWithEmailAndPassword(authInstance, email, password) {
  assertFirebaseAuthConfigured(authInstance)

  if (!isDemoAuth()) {
    assertOwnerOnlyAccess(email)
    return firebaseSignInWithEmailAndPassword(authInstance, email, password)
  }

  ensureDemoAdminUser()

  const normalizedEmail = normalizeEmail(email)
  assertOwnerOnlyAccess(normalizedEmail)
  const users = readDemoUsers()
  const user = users.find((item) => normalizeEmail(item.email) === normalizedEmail)

  if (!user) {
    throw makeAuthError('auth/user-not-found')
  }

  if (String(user.password) !== String(password || '')) {
    throw makeAuthError('auth/wrong-password')
  }

  writeCurrentUid(user.uid)
  const authUser = toDemoAuthUser(user)
  syncDemoCurrentUser(authInstance, authUser)
  notifyDemoAuthChange()

  return { user: authUser }
}

export async function signInWithPopup(authInstance, provider) {
  assertFirebaseAuthConfigured(authInstance)

  if (!isDemoAuth()) {
    const result = await firebaseSignInWithPopup(authInstance, provider)
    try {
      assertOwnerOnlyAccess(result?.user?.email)
      return result
    } catch (error) {
      await firebaseSignOut(authInstance)
      throw error
    }
  }

  ensureDemoAdminUser()

  const users = readDemoUsers()
  const demoEmail = isOwnerOnlyMode() ? getDemoAdminEmail() : 'demo.member@lionsfitness.app'
  let user = users.find((item) => normalizeEmail(item.email) === demoEmail)

  if (!user) {
    user = {
      uid: createUid(),
      email: demoEmail,
      password: 'google-oauth',
      displayName: 'Demo Member',
      photoURL: '',
      createdAt: new Date().toISOString(),
    }
    users.push(user)
    writeDemoUsers(users)
  }

  writeCurrentUid(user.uid)
  const authUser = toDemoAuthUser(user)
  syncDemoCurrentUser(authInstance, authUser)
  notifyDemoAuthChange()

  return { user: authUser }
}

export async function updateProfile(user, updates) {
  assertFirebaseAuthConfigured(appAuth)

  if (!isDemoAuth()) {
    return firebaseUpdateProfile(user, updates)
  }

  if (!user?.uid) return

  const users = readDemoUsers()
  const index = users.findIndex((item) => item.uid === user.uid)
  if (index < 0) return

  users[index] = {
    ...users[index],
    ...clone(updates),
  }
  writeDemoUsers(users)

  const authUser = toDemoAuthUser(users[index])
  syncDemoCurrentUser(appAuth, authUser)
  notifyDemoAuthChange()
}

export function onAuthStateChanged(authInstance, callback) {
  if (!isDemoAuth() && !authInstance) {
    queueMicrotask(() => callback(null))
    return () => {}
  }

  if (!isDemoAuth()) {
    return firebaseOnAuthStateChanged(authInstance, callback)
  }

  ensureDemoAdminUser()

  demoSubscribers.add(callback)
  queueMicrotask(() => {
    const currentUser = getCurrentDemoUser()
    syncDemoCurrentUser(authInstance, currentUser)
    callback(currentUser)
  })

  return () => {
    demoSubscribers.delete(callback)
  }
}

export async function sendPasswordResetEmail(authInstance, email) {
  assertFirebaseAuthConfigured(authInstance)

  if (!isDemoAuth()) {
    assertOwnerOnlyAccess(email)
    return firebaseSendPasswordResetEmail(authInstance, email)
  }

  const normalizedEmail = normalizeEmail(email)
  assertOwnerOnlyAccess(normalizedEmail)
  const exists = readDemoUsers().some((item) => normalizeEmail(item.email) === normalizedEmail)

  if (!exists) {
    throw makeAuthError('auth/user-not-found')
  }

  return true
}

export async function signOut(authInstance) {
  assertFirebaseAuthConfigured(authInstance)

  if (!isDemoAuth()) {
    return firebaseSignOut(authInstance)
  }

  writeCurrentUid('')
  syncDemoCurrentUser(authInstance, null)
  notifyDemoAuthChange()
}
