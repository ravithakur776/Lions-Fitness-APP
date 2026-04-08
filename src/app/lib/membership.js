import { todayISODate } from '@/src/app/lib/format'

export function addDaysToISODate(startDateIso, days) {
  const base = new Date(startDateIso || todayISODate())
  base.setDate(base.getDate() + Number(days || 0))
  return base.toISOString().slice(0, 10)
}

export function getDaysUntil(dateIso) {
  if (!dateIso) return null

  const today = new Date(todayISODate())
  const target = new Date(dateIso)
  const diffMs = target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

export function getDerivedMembershipStatus(rawStatus, expiryDateIso) {
  const explicit = String(rawStatus || '').toLowerCase()
  if (explicit === 'paused') return 'paused'

  const daysUntilExpiry = getDaysUntil(expiryDateIso)
  if (daysUntilExpiry !== null && daysUntilExpiry < 0) return 'expired'

  if (explicit === 'expired') return 'expired'
  return 'active'
}
