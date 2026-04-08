'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatCurrencyINR, formatDate, todayISODate } from '@/src/app/lib/format'
import { ADMIN_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'

const initialForm = {
  memberId: '',
  planName: 'Premium',
  amount: '',
  dueDate: todayISODate(),
  status: 'pending',
  receiptUrl: '',
}

export default function AdminPaymentsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.ADMIN)
  const logout = useLogout()

  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [membersSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', USER_ROLES.MEMBER))),
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'))),
      ])

      const memberRows = membersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      const paymentRows = paymentsSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      const today = todayISODate()
      const overdueRows = paymentRows.filter(
        (item) => item.status === 'pending' && item.dueDate && String(item.dueDate) < today
      )

      if (overdueRows.length > 0) {
        await Promise.all(
          overdueRows.flatMap((item) => {
            const updates = [updateDoc(doc(db, 'payments', item.id), { status: 'overdue', updatedAt: new Date().toISOString() })]
            if (item.memberId) {
              updates.push(
                updateDoc(doc(db, 'users', item.memberId, 'payments', item.id), {
                  status: 'overdue',
                  updatedAt: new Date().toISOString(),
                })
              )
            }
            return updates
          })
        )
      }

      const normalizedPayments = paymentRows.map((item) =>
        item.status === 'pending' && item.dueDate && String(item.dueDate) < today
          ? { ...item, status: 'overdue' }
          : item
      )

      setMembers(memberRows)
      setPayments(normalizedPayments)

      setForm((prev) => {
        if (prev.memberId || memberRows.length === 0) return prev
        return { ...prev, memberId: memberRows[0].id }
      })
    } catch {
      setStatus({ type: 'error', message: 'Could not load payments data.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    loadData()
  }, [loadData, user])

  const summary = useMemo(() => {
    const paid = payments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const pending = payments.filter((item) => item.status === 'pending').length
    const overdue = payments.filter((item) => item.status === 'overdue').length

    return { paid, pending, overdue }
  }, [payments])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    if (!form.memberId || !form.amount) {
      setStatus({ type: 'error', message: 'Member and amount are required.' })
      return
    }

    try {
      setSaving(true)

      const member = members.find((item) => item.id === form.memberId)
      const normalizedStatus =
        form.status === 'pending' && form.dueDate && form.dueDate < todayISODate() ? 'overdue' : form.status
      const payload = {
        memberId: form.memberId,
        memberName: member?.displayName || '',
        planName: form.planName,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        status: normalizedStatus,
        paidAt: normalizedStatus === 'paid' ? todayISODate() : null,
        receiptUrl: form.receiptUrl?.trim() || '',
        createdAt: new Date().toISOString(),
      }

      const paymentRef = await addDoc(collection(db, 'payments'), payload)
      await setDoc(doc(db, 'users', form.memberId, 'payments', paymentRef.id), payload)

      setStatus({ type: 'success', message: 'Payment record saved.' })
      setForm((prev) => ({ ...prev, amount: '', receiptUrl: '' }))
      await loadData()
    } catch {
      setStatus({ type: 'error', message: 'Could not save payment record.' })
    } finally {
      setSaving(false)
    }
  }

  if (!firebaseReady) {
    return <PageLoader label="Preparing app..." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading payments management..." />
  }

  return (
    <RoleLayout
      title="Payments Management"
      subtitle="Create and track due, paid, and overdue records"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={ADMIN_NAV}
      currentPath="/admin/payments"
      maxWidth="max-w-6xl"
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
        <StatCard label="Paid Total" value={formatCurrencyINR(summary.paid)} accent="text-green-300" />
        <StatCard label="Pending" value={`${summary.pending}`} accent="text-yellow-300" />
        <StatCard label="Overdue" value={`${summary.overdue}`} accent="text-red-300" />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Add Payment Record">
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              name="memberId"
              value={form.memberId}
              onChange={handleChange}
              className="lf-field"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.email}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                name="planName"
                type="text"
                value={form.planName}
                onChange={handleChange}
                placeholder="Plan name"
                className="lf-field"
              />
              <input
                name="amount"
                type="number"
                min="0"
                value={form.amount}
                onChange={handleChange}
                placeholder="Amount"
                className="lf-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                className="lf-field"
              />
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="lf-field"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                </select>
            </div>

            <input
              name="receiptUrl"
              type="url"
              value={form.receiptUrl}
              onChange={handleChange}
              placeholder="Receipt URL (optional)"
              className="lf-field"
            />

            <button
              type="submit"
              disabled={saving}
              className="lf-btn-primary"
            >
              {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </form>
        </Card>

        <Card title="Recent Records">
          {payments.length === 0 ? (
            <EmptyState title="No payment records yet" message="Create a payment record from the form to start tracking." />
          ) : (
            <div className="space-y-2">
              {payments.slice(0, 10).map((item) => (
                <article key={item.id} className="lf-item">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-orange-300">{item.memberName || item.memberId}</p>
                      <p className="text-xs text-gray-400">
                        {item.planName} • Due {formatDate(item.dueDate)}
                      </p>
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-300 underline"
                        >
                          Receipt
                        </a>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatCurrencyINR(item.amount)}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                          item.status === 'paid'
                            ? 'bg-green-500/20 text-green-200'
                            : item.status === 'overdue'
                              ? 'bg-red-500/20 text-red-200'
                              : 'bg-yellow-500/20 text-yellow-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  )
}
