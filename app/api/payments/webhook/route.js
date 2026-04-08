import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,X-Razorpay-Signature',
}

function isWebhookSignatureValid(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(String(signature || ''))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function parseEventDetails(payload) {
  const event = String(payload?.event || '')
  const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity || null

  return {
    event,
    paymentId: entity?.id || null,
    orderId: entity?.order_id || entity?.id || null,
    amount: entity?.amount || null,
    status: entity?.status || null,
    notes: entity?.notes || {},
  }
}

export const runtime = 'nodejs'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || ''
    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook secret is not configured.' },
        { status: 503, headers: CORS_HEADERS }
      )
    }

    const signature = request.headers.get('x-razorpay-signature') || ''
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const rawBody = await request.text()
    const valid = isWebhookSignatureValid(rawBody, signature, secret)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const payload = JSON.parse(rawBody)
    const details = parseEventDetails(payload)

    return NextResponse.json(
      {
        received: true,
        ...details,
      },
      { headers: CORS_HEADERS }
    )
  } catch {
    return NextResponse.json(
      { error: 'Could not process webhook.' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

