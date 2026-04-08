import { NextResponse } from 'next/server'

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
}

function getRazorpayConfig() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ''
  return { keyId, keySecret }
}

function normalizeAmountToPaise(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * 100)
}

export const runtime = 'nodejs'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    const { keyId, keySecret } = getRazorpayConfig()
    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error: 'Online payment is not configured yet. Add Razorpay keys in environment variables.',
        },
        { status: 503, headers: CORS_HEADERS }
      )
    }

    const body = await request.json()
    const amountInPaise = normalizeAmountToPaise(body?.amount)
    if (!amountInPaise) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400, headers: CORS_HEADERS })
    }

    const receipt = String(body?.receipt || `lf_${Date.now()}`).slice(0, 40)
    const payload = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: typeof body?.notes === 'object' && body.notes ? body.notes : {},
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.id) {
      return NextResponse.json(
        {
          error: data?.error?.description || 'Could not create payment order.',
        },
        { status: response.status || 500, headers: CORS_HEADERS }
      )
    }

    return NextResponse.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency || 'INR',
      keyId,
    }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'Could not start payment flow.' }, { status: 500, headers: CORS_HEADERS })
  }
}
