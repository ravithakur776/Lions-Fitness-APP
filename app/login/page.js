'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from '@/src/app/lib/auth'
import { auth, isDemoMode, isFirebaseConfigured } from '@/src/app/lib/firebase'
import { ensureUserProfile } from '@/src/app/lib/user-profile'
import { getDashboardPathByRole, ROLE_OPTIONS, USER_ROLES } from '@/src/app/lib/roles'

const provider = new GoogleAuthProvider()
const DEFAULT_DEMO_ADMIN_EMAIL = 'admin@lionsfitness.app'
const DEFAULT_DEMO_ADMIN_PASSWORD = 'Admin@12345'
const DEFAULT_DEMO_TRAINER_EMAIL = 'trainer@lionsfitness.app'
const DEFAULT_DEMO_TRAINER_PASSWORD = 'Trainer@12345'

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: USER_ROLES.MEMBER,
}

function getAuthMessage(error) {
  if (!error || !error.code) return 'Something went wrong. Please try again.'

  const messages = {
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/invalid-api-key': 'Firebase API key is invalid. Update your .env.local Firebase config.',
    'auth/app-not-authorized': 'This Firebase app is not authorized. Check your Firebase project settings.',
    'auth/operation-not-allowed': 'Email/password login is disabled in Firebase Auth settings.',
    'auth/network-request-failed': 'Network error while connecting to Firebase. Check internet and config.',
    'app/owner-only-access': `Access denied. Only owner email can login.`,
    'app/firebase-not-configured': 'Firebase is not configured. Add real Firebase keys in .env.local and restart.',
  }

  return messages[error.code] || 'Authentication failed. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const ownerOnlyMode = process.env.NEXT_PUBLIC_OWNER_ONLY_MODE === 'true'
  const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase()
  const allowRoleSelection = process.env.NEXT_PUBLIC_ALLOW_ROLE_SIGNUP === 'true'
  const configuredAdminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'))[0] || DEFAULT_DEMO_ADMIN_EMAIL
  const configuredAdminPassword = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_ADMIN_PASSWORD
  const configuredTrainerEmail = (process.env.NEXT_PUBLIC_TRAINER_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'))[0] || DEFAULT_DEMO_TRAINER_EMAIL
  const configuredTrainerPassword = process.env.NEXT_PUBLIC_DEMO_TRAINER_PASSWORD || DEFAULT_DEMO_TRAINER_PASSWORD
  const isSignup = !ownerOnlyMode && mode === 'signup'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false)
        return
      }

      try {
        const profile = await ensureUserProfile(user)
        router.replace(getDashboardPathByRole(profile?.role))
      } catch {
        router.replace('/dashboard')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const clearMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleRoleToggle = (nextMode) => {
    if (ownerOnlyMode && nextMode === 'signup') return
    setMode(nextMode)
    clearMessages()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    clearMessages()

    if (!isFirebaseConfigured) {
      setErrorMessage('Firebase is not configured. Add real Firebase keys in .env.local and restart.')
      return
    }

    if (!form.email || !form.password) {
      setErrorMessage('Email and password are required.')
      return
    }

    if (isSignup) {
      if (!form.name.trim()) {
        setErrorMessage('Name is required for sign up.')
        return
      }

      if (form.password !== form.confirmPassword) {
        setErrorMessage('Password and confirm password do not match.')
        return
      }
    }

    try {
      setLoading(true)

      if (isSignup) {
        const roleToAssign = allowRoleSelection ? form.role : USER_ROLES.MEMBER
        const result = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password)
        await updateProfile(result.user, { displayName: form.name.trim() })

        const profile = await ensureUserProfile(result.user, {
          displayName: form.name.trim(),
          role: roleToAssign,
        })

        router.push(getDashboardPathByRole(profile?.role))
      } else {
        const result = await signInWithEmailAndPassword(auth, form.email.trim(), form.password)
        const profile = await ensureUserProfile(result.user)

        router.push(getDashboardPathByRole(profile?.role))
      }

      setForm(initialForm)
    } catch (error) {
      setErrorMessage(getAuthMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    clearMessages()

    if (!isFirebaseConfigured) {
      setErrorMessage('Firebase is not configured. Add real Firebase keys in .env.local and restart.')
      return
    }

    try {
      setLoading(true)
      const result = await signInWithPopup(auth, provider)
      const profile = await ensureUserProfile(result.user, {
        role: USER_ROLES.MEMBER,
      })

      router.push(getDashboardPathByRole(profile?.role))
    } catch (error) {
      setErrorMessage(getAuthMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    clearMessages()

    if (!isFirebaseConfigured) {
      setErrorMessage('Firebase is not configured. Add real Firebase keys in .env.local and restart.')
      return
    }

    if (!form.email.trim()) {
      setErrorMessage('Enter your email first, then click forgot password.')
      return
    }

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, form.email.trim())
      setSuccessMessage('Password reset email sent. Check your inbox.')
    } catch (error) {
      setErrorMessage(getAuthMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = loading || checkingAuth

  return (
    <main className="lf-app-bg min-h-screen text-[var(--lf-text)]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-6 px-4 py-8 md:grid-cols-[1.12fr_420px]">
        <section className="lf-card lf-soft-glow hidden p-8 md:block">
          <div className="lf-chip mb-4 w-fit">
            <span className="lf-dot" />
            Welcome to
          </div>
          <h1 className="text-5xl font-semibold leading-none" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <span className="lf-gradient-title">Lions Fitness</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--lf-text-soft)]">
            Powerful role-based gym management for members, trainers, and admins. Built for clean workflows and
            daily consistency.
          </p>
          <div className="lf-divider my-5" />
          <div className="lf-stagger mt-3 grid gap-2">
            <div className="lf-item">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lf-accent-soft)]">Member</p>
              <p className="mt-1 text-sm text-[var(--lf-text-soft)]">Attendance, workouts, progress, payments.</p>
            </div>
            <div className="lf-item">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lf-accent-soft)]">Trainer</p>
              <p className="mt-1 text-sm text-[var(--lf-text-soft)]">Plans, assigned members, motivation alerts.</p>
            </div>
            <div className="lf-item">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lf-accent-soft)]">Admin</p>
              <p className="mt-1 text-sm text-[var(--lf-text-soft)]">Plans, payments, reports and announcements.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="lf-card-soft p-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">Users</p>
              <p className="mt-1 text-lg font-semibold">3 Roles</p>
            </div>
            <div className="lf-card-soft p-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">Tracking</p>
              <p className="mt-1 text-lg font-semibold">Realtime</p>
            </div>
            <div className="lf-card-soft p-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lf-text-soft)]">Payments</p>
              <p className="mt-1 text-lg font-semibold">UPI Ready</p>
            </div>
          </div>
        </section>

        <div className="w-full">
          <Link href="/" className="mb-3 inline-block text-xs text-[var(--lf-accent-soft)] hover:underline">
            ← Back to Home
          </Link>
          <div className="lf-card lf-soft-glow p-5 md:p-6">
            <div className="mb-5 text-center">
              <div className="lf-float mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--lf-accent)]">
                <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M14 4C10 4 7 7 7 11c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="#fff" />
                  <circle cx="14" cy="11" r="3" fill="#c04828" />
                </svg>
              </div>
              <h2 className="text-3xl font-semibold leading-none" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                <span className="lf-gradient-title">{isSignup ? 'Create Account' : 'Welcome Back'}</span>
              </h2>
              <p className="mt-1 text-xs text-[var(--lf-text-soft)]">
                {isSignup ? 'Join Lions Fitness in under a minute' : 'Log in to continue your fitness journey'}
              </p>
            </div>

            <div className="mb-4 flex rounded-xl border border-[var(--lf-border)] bg-[color-mix(in_srgb,var(--lf-surface-soft)_65%,transparent)] p-1">
              <button
                type="button"
                onClick={() => handleRoleToggle('login')}
                className={`w-1/2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  mode === 'login'
                    ? 'bg-[var(--lf-accent)] text-white'
                    : 'text-[var(--lf-text-soft)] hover:text-[var(--lf-text)]'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('signup')}
                disabled={ownerOnlyMode}
                className={`w-1/2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-[var(--lf-accent)] text-white'
                    : 'text-[var(--lf-text-soft)] hover:text-[var(--lf-text)]'
                } ${ownerOnlyMode ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Sign Up
              </button>
            </div>

            {ownerOnlyMode && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                Owner-only mode is active. Only <strong>{ownerEmail || configuredAdminEmail}</strong> can login.
              </div>
            )}

            {!isFirebaseConfigured && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                Firebase config missing. Add real `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`, then restart.
              </div>
            )}

            {isDemoMode && (
              <>
                <div className="mb-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
                  Demo mode is active. Roles are managed by admin/email config. Data is stored in this browser.
                </div>
                <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Single Admin Login: <strong>{configuredAdminEmail}</strong> / <strong>{configuredAdminPassword}</strong>
                </div>
                {!ownerOnlyMode && (
                  <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    Trainer Login: <strong>{configuredTrainerEmail}</strong> / <strong>{configuredTrainerPassword}</strong>
                  </div>
                )}
              </>
            )}

            {errorMessage && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignup && (
                <div>
                  <label htmlFor="name" className="lf-label">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ravi Thakur"
                    className="lf-field"
                  />
                </div>
              )}

              {isSignup && allowRoleSelection && (
                <div>
                  <label htmlFor="role" className="lf-label">
                    Role
                  </label>
                  <select id="role" name="role" value={form.role} onChange={handleChange} className="lf-field">
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="email" className="lf-label">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@email.com"
                  className="lf-field"
                />
              </div>

              <div>
                <label htmlFor="password" className="lf-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="lf-field"
                />
              </div>

              {isSignup && (
                <div>
                  <label htmlFor="confirmPassword" className="lf-label">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="lf-field"
                  />
                </div>
              )}

              {!isSignup && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isDisabled}
                  className="text-xs text-[var(--lf-accent-soft)] hover:underline disabled:opacity-60"
                >
                  Forgot password?
                </button>
              )}

              <button type="submit" disabled={isDisabled} className="lf-btn-primary">
                {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Continue'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--lf-border)]" />
              <span className="text-[11px] text-[var(--lf-text-soft)]">or</span>
              <div className="h-px flex-1 bg-[var(--lf-border)]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isDisabled}
              className="lf-btn-ghost w-full py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
