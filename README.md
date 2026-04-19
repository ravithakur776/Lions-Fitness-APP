# *Lions Fitness Gym App*

Lions Fitness is a complete role-based gym management app built with Next.js and Firebase.

## *Included Modules*

1. **Authentication**
- Email/password signup/login
- Google login
- Forgot password reset flow
- Admin-controlled role routing (`admin`, `trainer`, `member`)

2. **Member App**
- Dashboard
- Attendance check-in/history
- Progress tracker + log entries
- Payment history + online payment checkout (UPI/card/net-banking/wallet)
- Notifications
- Profile settings

3. **Trainer App**
- Dashboard
- Assigned members view
- Workout builder/assignment
- Attendance reporting
- Progress reporting
- Notifications sender

4. **Admin App**
- Dashboard
- Manage members
- Manage trainers
- Manage membership plans
- Manage payments
- Reports
- Announcements

## *Tech Stack*

- Next.js (App Router)
- React
- Firebase Auth
- Cloud Firestore
- Tailwind CSS

## *Quick Start*

1. Install dependencies
```bash
npm install
```

2. Configure environment (optional for demo mode)
```bash
cp .env.example .env.local
```
If you keep placeholder values, the app runs in **Demo Mode** (local auth + local data in browser storage).
If you add real Firebase values, it runs with Firebase Auth + Firestore.

3. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## *Demo Mode* (No Firebase Required)

- Works out of the box with no keys
- Sign up/login is fully functional
- Role-based dashboards (Admin/Trainer/Member) work
- Data persists in browser `localStorage`

## *Role Control* (Important)

- Roles are assigned from `users/{uid}.role` (admin panel updates this).
- You can force bootstrap roles by email via environment:
  - `NEXT_PUBLIC_ADMIN_EMAILS`
  - `NEXT_PUBLIC_TRAINER_EMAILS`
- In demo mode, a single admin account is auto-seeded from:
  - `NEXT_PUBLIC_ADMIN_EMAILS` (first email)
  - `NEXT_PUBLIC_DEMO_ADMIN_PASSWORD`
- Trainer test account is auto-seeded from:
  - `NEXT_PUBLIC_TRAINER_EMAILS` (first email)
  - `NEXT_PUBLIC_DEMO_TRAINER_PASSWORD`
- Keep `NEXT_PUBLIC_ALLOW_ROLE_SIGNUP=false` for strict admin-only control.
- For strict single-user access, set:
  - `NEXT_PUBLIC_OWNER_ONLY_MODE=true`
  - `NEXT_PUBLIC_OWNER_EMAIL=<your-email>`

## *Online Payments* (Razorpay)

- Member due payments support UPI, card, net-banking, and wallet checkout.
- Required environment variables:
  - `NEXT_PUBLIC_PAYMENT_API_BASE_URL` (required for APK/Capacitor builds, set deployed backend URL)
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- Payment verification is server-side through:
  - `POST /api/payments/create-order`
  - `POST /api/payments/verify`
  - `POST /api/payments/webhook`

## *Production Deploy*

Use the full guide in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Common commands:

```bash
npm run check:env
npm run build:strict
npm run firebase:login
npm run deploy:firebase:rules
npm run vercel:login
npm run deploy:vercel:prod
```

## *Firebase Setup* (Rules + Indexes)

This repo now includes:
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

Deploy them with Firebase CLI:
```bash
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

## *Routes*

- `/` Landing page
- `/login` Login / Signup / Google / Forgot password
- `/dashboard` Auto-route by role

- `/member/dashboard`
- `/member/attendance`
- `/member/progress`
- `/member/payments`
- `/member/notifications`
- `/member/profile`

- `/trainer/dashboard`
- `/trainer/members`
- `/trainer/workouts`
- `/trainer/attendance`
- `/trainer/progress`
- `/trainer/notifications`

- `/admin/dashboard`
- `/admin/members`
- `/admin/trainers`
- `/admin/plans`
- `/admin/payments`
- `/admin/reports`
- `/admin/announcements`

## *Firestore Data Shape* (Used By App)

- `users/{uid}`
  - role, displayName, email, trainerId, membershipStatus, membershipPlanName, fitnessGoal
- `users/{uid}/attendance/{dateId}`
- `users/{uid}/progress/{entryId}`
- `users/{uid}/workouts/{entryId}`
- `users/{uid}/payments/{paymentId}`
- `membershipPlans/{planId}`
- `payments/{paymentId}`
- `workoutPlans/{planId}`
- `notifications/{notificationId}`
- `announcements/{announcementId}`

## **Validation**

Current codebase validation:
- `npm run lint` passes
- `npm run build` passes
