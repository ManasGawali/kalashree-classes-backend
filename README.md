# Kalashree Music Classes — Fee Management System

A full MERN (MongoDB Atlas + Express + React + Node) application for managing
monthly student fees, built to run entirely on free tiers, split into **three deployable
pieces**:

| App               | Purpose                          | Example domain            |
|--------------------|-----------------------------------|-----------------------------|
| `backend`          | Shared API for both frontends     | `api.xyz.com`   |
| `frontend-public`  | Public site + student dashboard   | `www.xyz.com`   |
| `frontend-admin`   | Admin console                     | `admin.xyz.com` |

Splitting the frontends means the admin console is a completely separate deployment —
different domain/subdomain, its own build, and none of its code ships to student/public
visitors.

## Features

- **Public site** (`frontend-public`): batch list, fees, timings, contact — general
  resources, no login needed. Also hosts the student login + dashboard + payment flow.
  Student accounts are created by the admin only — there is no public self-registration.
  Students log in with their **phone number + password** (set by the admin when the
  account is created). Email is optional and only used for sending payment receipts.
- **Student dashboard** (mobile-first): paid-till date, next due date, month-wise UPI
  payment (select single or multiple consecutive months), auto-calculated amount, UPI QR
  with the amount pre-filled, transaction ID entry, instant email confirmation (if email
  is on file).
- **Admin console** (`frontend-admin`, separate app/domain): OTP-secured login
  (email+password → OTP emailed → verify), overview stats, editable per-batch monthly
  fees, batch-wise & month-wise fee collection view, student search with full payment
  history, add-student form, password reset for any student, and ability to reject a
  fraudulent payment (auto-recalculates that student's due date).
- **Design**: clean, plain white background with warm brown/tan accents (inspired by tabla
  wood & skin tones) — deliberately minimal, like a banking app, not a busy consumer site.
  Both frontends share the same visual theme so the brand feels consistent even though
  they're separate apps.

> Note: admin login uses **email** (for the OTP), since that's the admin's own account.
> Only **student** login uses phone number.

## Tech & free-tier services used

| Layer     | Tech                          | Free tier                      |
|-----------|--------------------------------|---------------------------------|
| Database  | MongoDB Atlas (M0 cluster)     | 512MB free forever              |
| Backend   | Node.js + Express               | Deploy free on Render/Railway   |
| Frontends | React + Vite (×2 separate apps) | Deploy free on Vercel/Netlify   |
| Email     | Resend                          | 3,000 emails/month free         |
| QR codes  | `qrcode` npm package (no API)  | Generated locally, no cost      |

---

## 1. MongoDB Atlas setup

1. Create a free account at https://www.mongodb.com/cloud/atlas.
2. Create an **M0 (free)** cluster.
3. Under **Database Access**, create a user with a password.
4. Under **Network Access**, allow access from `0.0.0.0/0` (or your host's IP once deployed).
5. Copy the connection string — this goes into `MONGO_URI` in the backend `.env`.

## 2. Resend (email) setup

1. Sign up free at https://resend.com.
2. Get your API key from the dashboard → goes into `RESEND_API_KEY`.
3. For quick testing you can send from `onboarding@resend.dev` (default `EMAIL_FROM` in
   `.env.example`). To send from your own domain, verify it in Resend first.

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your MongoDB URI, Resend key, JWT secret, admin credentials, UPI ID,
# and CLIENT_URLS (both frontend origins, comma-separated)

npm run seed     # creates the 7 batches with default fees + the first admin account
npm run dev       # starts on http://localhost:5000
```

Default batch fees created by the seed script (all editable later from the admin console):

| Batch                | Monthly Fee |
|-----------------------|-------------|
| Prarambhik             | Rs. 700     |
| Praveshika Pratham     | Rs. 800     |
| Praveshika Poorna      | Rs. 900     |
| Madhyama Pratham       | Rs. 1000    |
| Madhyama Poorna        | Rs. 1100    |
| Visharad Pratham       | Rs. 1300    |
| Visharad Poorna        | Rs. 1500    |

The seed script also creates one admin using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
**Log in once and be sure that email inbox is one you control**, since all future admin
logins require an OTP sent to it.

## 4. Public frontend setup (student site)

```bash
cd frontend-public
npm install
cp .env.example .env
# set VITE_API_URL to your backend URL + /api

npm run dev        # starts on http://localhost:5173
```

## 5. Admin frontend setup (separate app)

```bash
cd frontend-admin
npm install
cp .env.example .env
# set VITE_API_URL to your backend URL + /api (same backend as above)

npm run dev        # starts on http://localhost:5174
```

Both frontends talk to the **same backend** — they're just two separate React apps/builds
pointed at the same API.

## 6. Deploying for free

- **Backend** → Render.com or Railway.app free web service. Set the same environment
  variables as your local `.env`. Set `CLIENT_URLS` to both deployed frontend URLs,
  comma-separated (e.g. `https://www.kalashreemusic.com,https://admin.kalashreemusic.com`)
  — this is what allows both frontends to call the API via CORS.
- **frontend-public** → Vercel/Netlify, mapped to your main domain (`www.kalashreemusic.com`).
  Set `VITE_API_URL` to your backend URL + `/api`.
- **frontend-admin** → a **second, separate** Vercel/Netlify project, mapped to your admin
  subdomain (`admin.kalashreemusic.com`). Set the same `VITE_API_URL`. Since it's a fully
  separate deployment, you can additionally lock it down with your host's password
  protection / IP allowlist if you want an extra layer beyond the OTP login.
- **Database** → MongoDB Atlas M0 (already free, no change needed).
- **Email** → Resend free tier (no change needed).

## Adding students

Since there's no public sign-up, log in to the admin console → **Students** → **+ Add
Student**, and fill in name, phone number (this becomes their login ID), an initial
password, batch, and optionally an email (for receipts). The student can then log in
immediately on the public site's `/login` with that phone number and password. If they
forget it, the admin can reset it from the same Students page.

## How the payment flow works

1. Student logs in (by phone number, on the public site) and sees their dashboard:
   `paidTill` and `dueDate` are computed live from their `joinMonth/joinYear` and the last
   month they successfully paid for (`backend/utils/dateUtils.js`).
2. On the **Pay Now** page, they tap month chips (mobile-friendly) — selection is enforced
   to start at their due month and be consecutive, so nobody can skip owed months.
3. `POST /api/payments/quote` calculates `months × batch.monthlyFee` and generates a UPI QR
   code (`upi://pay?...&am=<amount>`) with the amount already embedded — the student just
   scans, and their UPI app opens with the amount pre-filled.
4. After paying in their UPI app, the student enters the transaction ID and hits confirm.
   `POST /api/payments/submit` records the payment, advances their `paidTillMonth/Year`, and
   emails a confirmation via Resend (if the student has an email on file).
5. Admin (on the separate admin console) can view any payment and, if a transaction ID
   turns out to be invalid, reject it — the student's due date is automatically
   recalculated from their remaining valid payments.

## Project structure

```
kalashree/
├── backend/
│   ├── config/db.js
│   ├── models/          (User, Batch, Payment, Admin, OTP)
│   ├── routes/           (auth, batches, user, payments, admin)
│   ├── middleware/auth.js
│   ├── utils/            (email via Resend, QR generation, due-date math, seed script)
│   └── server.js          (CORS allows both frontend origins via CLIENT_URLS)
│
├── frontend-public/        (deployed to www.kalashreemusic.com)
│   └── src/
│       ├── pages/          (Home, Login, UserDashboard, Payment)
│       ├── components/     (Navbar, Footer, MonthSelector, StatCard, ProtectedRoute)
│       ├── context/AuthContext.jsx   (stores token as kalashree_student_token)
│       ├── api/axios.js
│       └── styles/global.css
│
└── frontend-admin/          (deployed to admin.kalashreemusic.com)
    └── src/
        ├── pages/          (AdminLogin, AdminDashboard, AdminStudents, AdminFees)
        ├── components/     (Navbar, Footer, StatCard, ProtectedRoute)
        ├── context/AuthContext.jsx   (stores token as kalashree_admin_token)
        ├── api/axios.js
        └── styles/global.css        (same tabla theme + a small "Console" tag in the navbar)
```

## Notes / things to customize before going live

- Change `ADMIN_PASSWORD` immediately after first login (there's no in-app admin password
  change screen yet — you can add one, or update it directly in MongoDB Atlas).
- Set your real `UPI_ID` and `UPI_PAYEE_NAME` in the backend `.env`.
- Payments are auto-marked `completed` as soon as a transaction ID is entered (since this is
  a manual UPI flow with no payment gateway on the free tier). Admin can review and **reject**
  any payment later from the Students page if the transaction ID turns out to be invalid.
- Because the two frontends are now fully separate apps, make sure `CLIENT_URLS` on the
  backend is updated any time you change either frontend's deployed domain — otherwise CORS
  will block requests from the one you didn't update.
