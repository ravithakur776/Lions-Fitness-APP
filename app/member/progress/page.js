'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, limit, orderBy, query } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatDate, todayISODate } from '@/src/app/lib/format'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialMetrics = {
  date: todayISODate(),
  weight: '',
  chest: '',
  waist: '',
  arms: '',
  hips: '',
}

export default function MemberProgressPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()

  const [metrics, setMetrics] = useState(initialMetrics)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!user || !db) return

    loadProgress(user.uid)
  }, [user])

  const loadProgress = async (uid) => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users', uid, 'progress'), orderBy('date', 'desc'), limit(24))
      )
      setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load progress entries.' })
    }
  }

  const latest = entries[0]

  const weightTrend = useMemo(() => {
    return [...entries]
      .slice(0, 6)
      .reverse()
      .map((item) => Number(item.weight || 0))
      .filter((value) => value > 0)
  }, [entries])

  const weightRange = useMemo(() => {
    if (weightTrend.length === 0) return { min: 0, max: 1 }

    const min = Math.min(...weightTrend)
    const max = Math.max(...weightTrend)
    return { min, max: max === min ? max + 1 : max }
  }, [weightTrend])

  const kgLost = useMemo(() => {
    if (entries.length < 2) return 0

    const latestWeight = Number(entries[0]?.weight || 0)
    const oldestWeight = Number(entries[entries.length - 1]?.weight || 0)
    return Number((oldestWeight - latestWeight).toFixed(1))
  }, [entries])

  const handleChange = (event) => {
    const { name, value } = event.target
    setMetrics((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!user || !db) return

    if (!metrics.weight) {
      setStatus({ type: 'error', message: 'Weight is required.' })
      return
    }

    try {
      setSaving(true)
      await addDoc(collection(db, 'users', user.uid, 'progress'), {
        date: metrics.date,
        weight: Number(metrics.weight),
        chest: Number(metrics.chest || 0),
        waist: Number(metrics.waist || 0),
        arms: Number(metrics.arms || 0),
        hips: Number(metrics.hips || 0),
        createdAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Progress logged successfully.' })
      setMetrics({ ...initialMetrics, date: todayISODate() })
      await loadProgress(user.uid)
    } catch {
      setStatus({ type: 'error', message: 'Could not save progress entry.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading progress tracker..." />
  }

  return (
    <RoleLayout
      title="Progress Tracker"
      subtitle="Log body metrics and track your trend"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/progress"
      maxWidth="max-w-5xl"
    >
      {(error || status.message) && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            (error || status.type === 'error')
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-green-500/30 bg-green-500/10 text-green-200'
          }`}
        >
          {error || status.message}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <StatCard label="Weight" value={latest?.weight ? `${latest.weight} kg` : '-'} />
        <StatCard label="Chest / Waist" value={latest ? `${latest.chest || 0}/${latest.waist || 0}` : '-'} />
        <StatCard label="Kg Lost" value={`${kgLost}`} accent={kgLost >= 0 ? 'text-green-300' : 'text-red-300'} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Weight Over Recent Weeks">
          {weightTrend.length === 0 ? (
            <EmptyState title="No progress data yet" message="Log today's measurements to start your trend chart." />
          ) : (
            <>
              <div className="flex h-32 items-end gap-2">
                {weightTrend.map((weight, index) => {
                  const normalized = ((weight - weightRange.min) / (weightRange.max - weightRange.min)) * 100
                  const height = Math.max(16, normalized)
                  return (
                    <div key={`${weight}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-[#c04828]"
                        style={{ height: `${height}%` }}
                        title={`${weight} kg`}
                      />
                      <span className="text-[10px] text-[var(--lf-text-soft)]">W{index + 1}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-[var(--lf-text-soft)]">Weight over recent weeks.</p>
            </>
          )}
        </Card>

        <Card title="Log Today's Measurements">
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              name="date"
              type="date"
              value={metrics.date}
              onChange={handleChange}
              className="lf-field"
            />
            <div className="grid grid-cols-2 gap-2">
              <InputField name="weight" value={metrics.weight} onChange={handleChange} placeholder="Weight kg" />
              <InputField name="chest" value={metrics.chest} onChange={handleChange} placeholder="Chest cm" />
              <InputField name="waist" value={metrics.waist} onChange={handleChange} placeholder="Waist" />
              <InputField name="arms" value={metrics.arms} onChange={handleChange} placeholder="Arms cm" />
              <InputField name="hips" value={metrics.hips} onChange={handleChange} placeholder="Hips cm" />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Log today measurements'}
            </button>
          </form>
        </Card>
      </div>

      <Card title="Recent Logs" className="mt-4">
        {entries.length === 0 ? (
          <EmptyState title="No logs yet" message="Once you add measurements, your history will show here." />
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 8).map((item) => (
              <article key={item.id} className="lf-item">
                <p className="text-sm font-semibold text-[var(--lf-text)]">{formatDate(item.date)}</p>
                <p className="text-xs text-[var(--lf-text-soft)]">
                  Weight: {item.weight || 0} kg • Chest: {item.chest || 0} • Waist: {item.waist || 0} • Arms:{' '}
                  {item.arms || 0} • Hips: {item.hips || 0}
                </p>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}

function InputField({ name, value, onChange, placeholder }) {
  return (
    <input
      name={name}
      type="number"
      min="0"
      step="0.1"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="lf-field"
    />
  )
}
