'use client'

import { useEffect, useState } from 'react'
import { doc, updateDoc } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout } from '@/src/app/components/role-layout'
import { PageLoader } from '@/src/app/components/ui-states'

export default function MemberProfilePage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()

  const [form, setForm] = useState({
    displayName: '',
    phone: '',
    fitnessGoal: '',
    height: '',
    bloodGroup: '',
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return

    setForm({
      displayName: profile.displayName || '',
      phone: profile.phone || '',
      fitnessGoal: profile.fitnessGoal || '',
      height: profile.height || '',
      bloodGroup: profile.bloodGroup || '',
    })
  }, [profile])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!user || !db) return

    try {
      setSaving(true)
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        fitnessGoal: form.fitnessGoal.trim(),
        height: form.height.trim(),
        bloodGroup: form.bloodGroup.trim(),
        updatedAt: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Profile updated.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not update profile.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading profile..." />
  }

  return (
    <RoleLayout
      title="Profile & Settings"
      subtitle="Manage your personal details"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/profile"
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

      <Card title="Member Profile">
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <InputField label="Full Name" name="displayName" value={form.displayName} onChange={handleChange} />
          <InputField label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          <InputField label="Fitness Goal" name="fitnessGoal" value={form.fitnessGoal} onChange={handleChange} />
          <InputField label="Height" name="height" value={form.height} onChange={handleChange} />
          <InputField label="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={handleChange} />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </Card>
    </RoleLayout>
  )
}

function InputField({ label, name, value, onChange }) {
  return (
    <label className="block">
      <span className="lf-label mb-1 block text-xs">{label}</span>
      <input
        name={name}
        type="text"
        value={value}
        onChange={onChange}
        className="lf-field"
      />
    </label>
  )
}
