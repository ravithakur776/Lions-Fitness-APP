'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, orderBy, query, updateDoc } from '@/src/app/lib/firestore'
import { db } from '@/src/app/lib/firebase'
import { USER_ROLES } from '@/src/app/lib/roles'
import { useAuthRole } from '@/src/app/lib/use-auth-role'
import { useLogout } from '@/src/app/lib/use-logout'
import { formatCurrencyINR, formatDate, todayISODate } from '@/src/app/lib/format'
import { MEMBER_NAV } from '@/src/app/lib/nav'
import { Card, RoleLayout, StatCard } from '@/src/app/components/role-layout'
import { EmptyState, PageLoader } from '@/src/app/components/ui-states'
import { buildPaymentApiUrl, getPaymentApiBaseUrl } from '@/src/app/lib/payment-api'

const RAZORPAY_SCRIPT_ID = 'lf-razorpay-checkout-sdk'
const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export default function MemberPaymentsPage() {
  const { loading, user, profile, error, firebaseReady } = useAuthRole(USER_ROLES.MEMBER)
  const logout = useLogout()

  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [payingId, setPayingId] = useState('')
  const [gatewayReady, setGatewayReady] = useState(false)
  const [gatewayChecked, setGatewayChecked] = useState(false)
  const paymentApiBaseUrl = getPaymentApiBaseUrl()

  const loadPayments = useCallback(async (uid) => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users', uid, 'payments'), orderBy('dueDate', 'desc'))
      )
      setPayments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    } catch {
      setStatus({ type: 'error', message: 'Could not load payments.' })
    }
  }, [])

  useEffect(() => {
    if (!user || !db) return

    const timer = setTimeout(() => {
      void loadPayments(user.uid)
    }, 0)

    return () => clearTimeout(timer)
  }, [loadPayments, user])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const markReady = () => {
      setGatewayReady(Boolean(window.Razorpay))
      setGatewayChecked(true)
    }

    if (window.Razorpay) {
      markReady()
      return
    }

    const existing = document.getElementById(RAZORPAY_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', markReady)
      existing.addEventListener('error', markReady)

      return () => {
        existing.removeEventListener('load', markReady)
        existing.removeEventListener('error', markReady)
      }
    }

    const script = document.createElement('script')
    script.id = RAZORPAY_SCRIPT_ID
    script.src = RAZORPAY_SCRIPT_SRC
    script.async = true
    script.onload = markReady
    script.onerror = markReady
    document.body.appendChild(script)

    return () => {
      script.onload = null
      script.onerror = null
    }
  }, [])

  const summary = useMemo(() => {
    const today = todayISODate()
    const normalized = payments.map((item) => ({
      ...item,
      status:
        item.status === 'pending' && item.dueDate && String(item.dueDate) < today ? 'overdue' : item.status,
    }))

    const totalPaid = normalized
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const overdueCount = normalized.filter((item) => item.status === 'overdue').length

    const nextDue = normalized
      .filter((item) => item.status !== 'paid')
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0]

    return { totalPaid, overdueCount, nextDue }
  }, [payments])

  const syncPaymentSuccess = useCallback(
    async (item, gatewayPaymentId, gatewayOrderId) => {
      if (!user || !db) return

      const updates = {
        status: 'paid',
        paidAt: todayISODate(),
        gateway: 'razorpay',
        gatewayPaymentId: gatewayPaymentId || '',
        gatewayOrderId: gatewayOrderId || '',
        updatedAt: new Date().toISOString(),
      }

      await updateDoc(doc(db, 'users', user.uid, 'payments', item.id), updates)

      try {
        await updateDoc(doc(db, 'payments', item.id), updates)
      } catch {
        // Some records may only exist in user subcollection.
      }
    },
    [user]
  )

  const handlePayNow = useCallback(
    async (item) => {
      if (!user || !db) return
      if (!gatewayReady || typeof window === 'undefined' || !window.Razorpay) {
        setStatus({
          type: 'error',
          message: 'Online payment gateway is not ready. Please refresh and try again.',
        })
        return
      }

      const amount = Number(item.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus({ type: 'error', message: 'Invalid payment amount.' })
        return
      }

      try {
        setPayingId(item.id)
        setStatus({ type: '', message: '' })

        const createOrderResponse = await fetch(buildPaymentApiUrl('/api/payments/create-order'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            receipt: `member_${user.uid}_${item.id}`.slice(0, 40),
            notes: {
              memberId: user.uid,
              paymentDocId: item.id,
              planName: item.planName || 'Membership',
            },
          }),
        })

        const createOrderData = await createOrderResponse.json().catch(() => null)
        if (!createOrderResponse.ok || !createOrderData?.orderId) {
          throw new Error(createOrderData?.error || 'Could not initialize payment.')
        }

        const razorpay = new window.Razorpay({
          key: createOrderData.keyId,
          amount: createOrderData.amount,
          currency: createOrderData.currency || 'INR',
          name: 'Lions Fitness',
          description: `${item.planName || 'Membership'} Payment`,
          order_id: createOrderData.orderId,
          prefill: {
            name: profile?.displayName || user.displayName || '',
            email: user.email || '',
            contact: profile?.phone || '',
          },
          notes: {
            memberId: user.uid,
            paymentDocId: item.id,
          },
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true,
          },
          theme: {
            color: '#c04828',
          },
          handler: async (response) => {
            try {
              const verifyResponse = await fetch(buildPaymentApiUrl('/api/payments/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              })

              const verifyData = await verifyResponse.json().catch(() => null)
              if (!verifyResponse.ok || !verifyData?.verified) {
                throw new Error(verifyData?.error || 'Payment verification failed.')
              }

              await syncPaymentSuccess(item, response?.razorpay_payment_id, response?.razorpay_order_id)
              await loadPayments(user.uid)
              setStatus({ type: 'success', message: 'Payment completed successfully.' })
            } catch (verificationError) {
              setStatus({
                type: 'error',
                message: verificationError?.message || 'Could not verify payment. Please contact support.',
              })
            } finally {
              setPayingId('')
            }
          },
          modal: {
            ondismiss: () => {
              setPayingId('')
            },
          },
        })

        razorpay.on('payment.failed', (event) => {
          setStatus({
            type: 'error',
            message: event?.error?.description || 'Payment failed. Please try again.',
          })
          setPayingId('')
        })

        razorpay.open()
      } catch (paymentError) {
        setStatus({ type: 'error', message: paymentError?.message || 'Could not start payment.' })
        setPayingId('')
      }
    },
    [gatewayReady, loadPayments, profile?.displayName, profile?.phone, syncPaymentSuccess, user]
  )

  if (!firebaseReady) {
    return <PageLoader label="Firebase setup required. Add your .env.local credentials." />
  }

  if (loading || !user) {
    return <PageLoader label="Loading payments..." />
  }

  return (
    <RoleLayout
      title="Payments"
      subtitle="Track dues and payment history"
      userName={profile?.displayName || user.displayName || user.email}
      onLogout={logout}
      navItems={MEMBER_NAV}
      currentPath="/member/payments"
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
        <StatCard label="Total Paid" value={formatCurrencyINR(summary.totalPaid)} accent="text-green-300" />
        <StatCard label="Overdue" value={`${summary.overdueCount}`} accent="text-red-300" />
        <StatCard
          label="Next Due"
          value={summary.nextDue?.dueDate ? formatDate(summary.nextDue.dueDate) : '-'}
          accent="text-yellow-300"
        />
      </section>

      <Card title="Pay Online" className="mb-4">
        <p className="text-sm text-[var(--lf-text-soft)]">
          Pay pending dues securely via UPI, cards, net-banking, or wallet.
        </p>
        <p className="mt-1 text-xs text-[var(--lf-text-soft)]">
          Gateway status:{' '}
          {gatewayReady ? (
            <span className="text-green-300">Ready</span>
          ) : gatewayChecked ? (
            <span className="text-yellow-300">Not configured</span>
          ) : (
            <span className="text-[var(--lf-text-soft)]">Checking...</span>
          )}
        </p>
        <p className="mt-1 text-[10px] text-[var(--lf-text-soft)]">
          Payment backend: {paymentApiBaseUrl || 'same-origin'}
        </p>
      </Card>

      <Card title="Payment History">
        {payments.length === 0 ? (
          <EmptyState title="No payment records yet" message="Your dues and receipts will appear here once generated." />
        ) : (
          <div className="space-y-2">
            {payments.map((item) => (
              <article key={item.id} className="lf-item">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-orange-300">{item.planName || 'Membership Payment'}</p>
                    <p className="text-xs text-[var(--lf-text-soft)]">
                      Due: {formatDate(item.dueDate)}{item.paidAt ? ` • Paid: ${formatDate(item.paidAt)}` : ''}
                    </p>
                    {item.receiptUrl && (
                      <a
                        href={item.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-300 underline-offset-2 hover:underline"
                      >
                        Download receipt
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    {(() => {
                      const normalizedStatus =
                        item.status === 'pending' && item.dueDate && String(item.dueDate) < todayISODate()
                          ? 'overdue'
                          : item.status

                      return (
                        <>
                          <p className="text-sm font-semibold text-white">{formatCurrencyINR(item.amount)}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[10px] uppercase ${
                              normalizedStatus === 'paid'
                                ? 'bg-green-500/20 text-green-200'
                                : normalizedStatus === 'overdue'
                                  ? 'bg-red-500/20 text-red-200'
                                  : 'bg-yellow-500/20 text-yellow-200'
                            }`}
                          >
                            {normalizedStatus || 'pending'}
                          </span>

                          {normalizedStatus !== 'paid' && (
                            <button
                              type="button"
                              disabled={payingId === item.id || !gatewayReady}
                              onClick={() => {
                                void handlePayNow(item)
                              }}
                              className="mt-2 w-full rounded-lg border border-[var(--lf-accent)] bg-[var(--lf-accent)] px-2 py-1 text-[11px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {payingId === item.id ? 'Processing...' : 'Pay Now (UPI/Card)'}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  )
}
