# Lions Fitness Production Deployment

## 1. Vercel App Deploy

1. Push this code to GitHub/GitLab/Bitbucket.
2. Import repo in Vercel.
3. Add all variables from `.env.production.example` into Vercel Project Settings > Environment Variables.
4. Keep `NEXT_PUBLIC_ALLOW_ROLE_SIGNUP=false` in production.
5. Trigger deploy.

Razorpay variables required for live member payments:
- `NEXT_PUBLIC_PAYMENT_API_BASE_URL` (for APK builds, set this to your deployed URL)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Razorpay webhook:
- URL: `https://<your-domain>/api/payments/webhook`
- Events: `payment.captured`, `payment.failed`

## 2. Firebase Setup

1. Create Firebase project (or use existing one).
2. Enable Authentication methods:
- Email/Password
- Google
3. Create Firestore database (production mode).
4. Deploy security + indexes:

```bash
npm run deploy:firebase:rules
```

You can also deploy all Firebase config:

```bash
npm run deploy:firebase:all
```

## 3. Production Safety Checks

Run local strict check before production release:

```bash
npm run check:env
npm run build:strict
```

## 4. Post-deploy Smoke Test

1. Open `/login`
2. Create a member account
3. Login as admin/trainer/member
4. Validate each dashboard loads and CRUD actions work
5. Validate Firestore writes appear in Firebase console
6. As member, click `Pay Now (UPI/Card)` on a pending due and verify status becomes `paid`

## 5. APK/Capacitor Payment Setup

Before building APK, ensure:
- App is deployed and reachable over HTTPS (for API + Razorpay checkout).
- `NEXT_PUBLIC_PAYMENT_API_BASE_URL` points to deployed backend (e.g. `https://your-app.vercel.app`).

Then build APK:

```bash
npm run apk:debug
```
