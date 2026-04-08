export const USER_ROLES = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  MEMBER: 'member',
}

export const ROLE_OPTIONS = [
  { value: USER_ROLES.MEMBER, label: 'Member' },
  { value: USER_ROLES.TRAINER, label: 'Trainer' },
  { value: USER_ROLES.ADMIN, label: 'Admin' },
]

export function normalizeRole(role) {
  const value = String(role || '').toLowerCase()

  if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN
  if (value === USER_ROLES.TRAINER) return USER_ROLES.TRAINER
  return USER_ROLES.MEMBER
}

function parseEmailList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'))
}

const DEFAULT_ADMIN_EMAIL = 'admin@lionsfitness.app'

export function getConfiguredAdminEmails() {
  const emails = parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS)
  if (emails.length > 0) return emails
  return [DEFAULT_ADMIN_EMAIL]
}

export function isConfiguredAdminEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return false
  return getConfiguredAdminEmails().includes(normalizedEmail)
}

export function hasConfiguredAdminEmails() {
  return getConfiguredAdminEmails().length > 0
}

export function isOwnerOnlyMode() {
  return String(process.env.NEXT_PUBLIC_OWNER_ONLY_MODE || 'false').trim().toLowerCase() === 'true'
}

export function getOwnerEmail() {
  const explicitOwner = String(process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase()
  if (explicitOwner.includes('@')) return explicitOwner
  return getConfiguredAdminEmails()[0] || ''
}

export function isOwnerEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return false
  return normalizedEmail === getOwnerEmail()
}

export function getRoleFromConfiguredEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return null

  const adminEmails = getConfiguredAdminEmails()
  if (adminEmails.includes(normalizedEmail)) {
    return USER_ROLES.ADMIN
  }

  const trainerEmails = parseEmailList(process.env.NEXT_PUBLIC_TRAINER_EMAILS)
  if (trainerEmails.includes(normalizedEmail)) {
    return USER_ROLES.TRAINER
  }

  return null
}

export function getDashboardPathByRole(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === USER_ROLES.ADMIN) return '/admin/dashboard'
  if (normalizedRole === USER_ROLES.TRAINER) return '/trainer/dashboard'
  return '/member/dashboard'
}
