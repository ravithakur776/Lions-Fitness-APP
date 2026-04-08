import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import {
  getRoleFromConfiguredEmail,
  hasConfiguredAdminEmails,
  isConfiguredAdminEmail,
  normalizeRole,
  USER_ROLES,
} from '@/src/app/lib/roles'
import { addDaysToISODate } from '@/src/app/lib/membership'
import { todayISODate } from '@/src/app/lib/format'

export async function getUserProfile(uid) {
  if (!db || !uid) return null

  const userRef = doc(db, 'users', uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    role: normalizeRole(data.role),
  }
}

export async function ensureUserProfile(user, options = {}) {
  if (!db || !user) return null

  const preferredRole = normalizeRole(options.role)
  const userRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(userRef)

  if (snapshot.exists()) {
    const existing = snapshot.data()
    const email = user.email || existing.email || ''
    const configuredRole = getRoleFromConfiguredEmail(email)

    const updates = {
      updatedAt: serverTimestamp(),
    }

    if (configuredRole && normalizeRole(existing.role) !== configuredRole) {
      updates.role = configuredRole
    }

    if (!existing.role && !updates.role) {
      updates.role = USER_ROLES.MEMBER
    }

    if (
      !configuredRole &&
      hasConfiguredAdminEmails() &&
      normalizeRole(existing.role) === USER_ROLES.ADMIN &&
      !isConfiguredAdminEmail(email)
    ) {
      updates.role = USER_ROLES.MEMBER
    }

    if (!existing.membershipPlanName) {
      updates.membershipPlanName = 'Basic'
    }

    if (!existing.membershipStartedAt) {
      updates.membershipStartedAt = todayISODate()
    }

    if (!existing.membershipExpiresAt) {
      updates.membershipExpiresAt = addDaysToISODate(todayISODate(), 30)
    }

    if (!existing.membershipStatus) {
      updates.membershipStatus = 'active'
    }

    if (!existing.displayName && user.displayName) {
      updates.displayName = user.displayName
    }

    if (!existing.email && user.email) {
      updates.email = user.email
    }

    if (Object.keys(updates).length > 1) {
      await updateDoc(userRef, updates)
    }

    return {
      id: snapshot.id,
      ...existing,
      ...updates,
      role: normalizeRole(updates.role || existing.role || configuredRole),
    }
  }

  const configuredRole = getRoleFromConfiguredEmail(user.email || '')
  const safePreferredRole = preferredRole === USER_ROLES.ADMIN ? USER_ROLES.MEMBER : preferredRole

  const newProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: options.displayName || user.displayName || '',
    photoURL: user.photoURL || '',
    role: configuredRole || safePreferredRole || USER_ROLES.MEMBER,
    membershipPlanName: 'Basic',
    membershipStatus: 'active',
    membershipStartedAt: todayISODate(),
    membershipExpiresAt: addDaysToISODate(todayISODate(), 30),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(userRef, newProfile)

  return {
    id: user.uid,
    ...newProfile,
    role: normalizeRole(newProfile.role),
  }
}
