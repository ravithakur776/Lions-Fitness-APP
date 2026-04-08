import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
}

function isSignatureValid(orderId, paymentId, signature, keySecret) {
  const payload = `${orderId}|${paymentId}`
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex')

  const left = Buffer.from(expected)
  const right = Buffer.from(String(signature || ''))
  if (left.length !== right.length) return false

  return crypto.timingSafeEqual(left, right)
}

export const runtime = 'nodejs'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || ''
    if (!keySecret) {
      return NextResponse.json({ error: 'Payment verification is not configured.' }, { status: 503, headers: CORS_HEADERS })
    }

    const body = await request.json()
    const orderId = String(body?.razorpay_order_id || '')
    const paymentId = String(body?.razorpay_payment_id || '')
    const signature = String(body?.razorpay_signature || '')

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing payment verification fields.' }, { status: 400, headers: CORS_HEADERS })
    }

    const valid = isSignatureValid(orderId, paymentId, signature, keySecret)
    if (!valid) {
      return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400, headers: CORS_HEADERS })
    }

    return NextResponse.json({
      verified: true,
      orderId,
      paymentId,
    }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'Could not verify payment.' }, { status: 500, headers: CORS_HEADERS })
  }
}
