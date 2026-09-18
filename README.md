# Kalashree Music Classes — Backend API

REST API server for Kalashree Music Classes, handling authentication, student management, fee payments (UPI + QR), and automated email notifications.

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Runtime      | Node.js ≥ 18                        |
| Framework    | Express.js 4.x                      |
| Database     | MongoDB Atlas (Mongoose 8.x ODM)    |
| Auth         | JWT (jsonwebtoken)                   |
| Email        | Resend API                           |
| QR Generator | `qrcode` (UPI deep-link QR codes)   |
| Scheduler    | `node-cron` + external cron webhooks |
| Passwords    | bcryptjs (salted hashing)            |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env and fill in your values
cp .env.example .env

# 3. Seed the database (creates admin + 7 batches)
npm run seed

# 4. Start the dev server (auto-restarts on file changes)
npm run dev

# 5. Or start for production
npm start
```

The server runs on `http://localhost:5000` by default.

---

## Environment Variables

| Variable         | Description                                                        | Example                                         |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `MONGO_URI`      | MongoDB Atlas connection string                                    | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/kalashree` |
| `JWT_SECRET`     | Secret key for signing JWT tokens                                  | `a-long-random-string`                          |
| `RESEND_API_KEY`  | API key from [Resend](https://resend.com)                         | `re_xxxxxxxxxxxxxx`                             |
| `EMAIL_FROM`     | Sender name + email for outgoing mail                              | `Kalashree Music Classes <onboarding@resend.dev>` |
| `ADMIN_EMAIL`    | Admin's email (receives cron reports)                              | `admin@kalashreemusic.com`                      |
| `ADMIN_PASSWORD` | Initial admin password (used by seed script only)                  | `ChangeMe@123`                                  |
| `UPI_ID`         | UPI VPA that receives student payments                             | `kalashreemusic@okhdfcbank`                     |
| `UPI_PAYEE_NAME` | Payee display name for UPI QR                                      | `Kalashree Music Classes`                       |
| `PORT`           | Server port                                                        | `5000`                                          |
| `CLIENT_URLS`    | Comma-separated allowed CORS origins                               | `https://www.kalashreemusic.com,https://admin.kalashreemusic.com` |
| `CRON_SECRET`    | Shared secret to authenticate external cron webhook calls          | `a-random-string`                               |

---

## Project Structure

```
backend/
├── server.js              # Express app entry point, CORS, routes, cron webhook
├── config/
│   └── db.js              # MongoDB connection
├── middleware/
│   └── auth.js            # JWT verification, requireUser, requireAdmin guards
├── models/
│   ├── Admin.js           # Admin account (email + hashed password)
│   ├── Batch.js           # 7 fixed curriculum levels with editable fees
│   ├── OTP.js             # Time-limited OTPs for admin login & password reset
│   ├── Payment.js         # Fee payment records (UPI transaction ID, months covered)
│   └── User.js            # Student accounts (phone login, batch, paidTill pointer)
├── routes/
│   ├── authRoutes.js      # Login (student + admin), OTP verification, password reset
│   ├── batchRoutes.js     # List batches (public), update fee (admin)
│   ├── userRoutes.js      # Student dashboard data
│   ├── paymentRoutes.js   # Quote (QR generation), submit payment, payment history
│   └── adminRoutes.js     # Dashboard stats, student CRUD, fee collection view, reports
├── utils/
│   ├── dateUtils.js       # Month arithmetic, payment status calculator
│   ├── generateQR.js      # UPI QR code generator (data URL)
│   ├── scheduler.js       # Cron job definitions (3 scheduled jobs)
│   ├── seed.js            # Database seeder (admin account + 7 batches)
│   ├── sendEmail.js       # All email templates (Resend API)
│   └── testEmails.js      # Manual email testing script
├── .env.example
├── package.json
└── .gitignore
```

---

## Database Models

### User (Student)
| Field           | Type       | Notes                                      |
| --------------- | ---------- | ------------------------------------------ |
| `name`          | String     | Required                                   |
| `phone`         | String     | Required, unique — **login identifier**    |
| `email`         | String     | Optional, unique, sparse — for receipts    |
| `password`      | String     | Hashed with bcrypt                         |
| `batch`         | ObjectId   | References `Batch`                         |
| `joinMonth`     | Number     | 1–12, first month fees are due             |
| `joinYear`      | Number     | Year of joining                            |
| `paidTillMonth` | Number     | Last fully paid month (null = never paid)  |
| `paidTillYear`  | Number     | Last fully paid year                       |
| `isActive`      | Boolean    | Soft-delete flag                           |

### Batch
| Field        | Type   | Notes                                |
| ------------ | ------ | ------------------------------------ |
| `name`       | String | One of 7 fixed levels (enum)         |
| `monthlyFee` | Number | Admin-editable fee amount            |

**7 Curriculum Levels:** Prarambhik → Praveshika Pratham → Praveshika Poorna → Madhyama Pratham → Madhyama Poorna → Visharad Pratham → Visharad Poorna

### Payment
| Field                | Type     | Notes                                         |
| -------------------- | -------- | --------------------------------------------- |
| `user`               | ObjectId | References `User`                             |
| `batch`              | ObjectId | References `Batch`                            |
| `batchNameSnapshot`  | String   | Batch name at time of payment                 |
| `feePerMonthSnapshot`| Number   | Fee per month at time of payment              |
| `months`             | Array    | `[{month, year}]` — months this payment covers|
| `amount`             | Number   | Total amount paid                             |
| `transactionId`      | String   | UPI transaction reference ID                  |
| `status`             | String   | `pending` / `completed` / `rejected`          |
| `rejectionReason`    | String   | Reason if rejected by admin                   |
| `emailSent`          | Boolean  | Whether confirmation email was sent           |

### Admin
| Field      | Type   | Notes                       |
| ---------- | ------ | --------------------------- |
| `email`    | String | Login identifier            |
| `password` | String | Hashed with bcrypt          |
| `name`     | String | Display name (default: "Admin") |

### OTP
| Field       | Type   | Notes                          |
| ----------- | ------ | ------------------------------ |
| `identifier`| String | Email or phone                 |
| `otp`       | String | 6-digit code                   |
| `expiresAt` | Date   | Auto-expires after 5 minutes   |

---

## API Reference

### Health Check
| Method | Endpoint         | Auth | Description       |
| ------ | ---------------- | ---- | ----------------- |
| GET    | `/api/health`    | —    | Server health check |

### Authentication (`/api/auth`)
| Method | Endpoint                     | Auth | Description                                |
| ------ | ---------------------------- | ---- | ------------------------------------------ |
| POST   | `/login`                     | —    | Student login (phone + password)           |
| POST   | `/admin/login`               | —    | Admin login step 1 (email + password → OTP)|
| POST   | `/admin/verify-otp`          | —    | Admin login step 2 (verify OTP → JWT)      |
| POST   | `/forgot-password/send-otp`  | —    | Send password reset OTP to student email   |
| POST   | `/forgot-password/verify-otp`| —    | Verify reset OTP                           |
| POST   | `/forgot-password/reset`     | —    | Set new password with verified OTP         |

### Batches (`/api/batches`)
| Method | Endpoint     | Auth  | Description                 |
| ------ | ------------ | ----- | --------------------------- |
| GET    | `/`          | —     | List all batches with fees  |
| PUT    | `/:id`       | Admin | Update a batch's monthly fee|

### Student Dashboard (`/api/user`)
| Method | Endpoint      | Auth | Description                                    |
| ------ | ------------- | ---- | ---------------------------------------------- |
| GET    | `/dashboard`  | User | Payment status, payable months, recent payments|

### Payments (`/api/payments`)
| Method | Endpoint  | Auth | Description                                    |
| ------ | --------- | ---- | ---------------------------------------------- |
| POST   | `/quote`  | User | Calculate amount + generate UPI QR for months  |
| POST   | `/submit` | User | Submit transaction ID to record payment        |
| GET    | `/mine`   | User | Full payment history for logged-in student     |

### Admin (`/api/admin`)
| Method | Endpoint                          | Auth  | Description                           |
| ------ | --------------------------------- | ----- | ------------------------------------- |
| GET    | `/stats`                          | Admin | Dashboard stats (totals, overdue)     |
| POST   | `/students`                       | Admin | Create a new student account          |
| GET    | `/students`                       | Admin | List/search students                  |
| GET    | `/students/:id`                   | Admin | Student detail + payment history      |
| PUT    | `/students/:id/reset-password`    | Admin | Reset a student's password            |
| PUT    | `/students/:id/status`            | Admin | Activate/deactivate a student         |
| GET    | `/fees`                           | Admin | Batch-wise fee collection by month    |
| PUT    | `/payments/:id/reject`            | Admin | Reject a payment + recalculate dues   |
| POST   | `/test-scheduled-emails`          | Admin | Manually trigger scheduled email jobs |

### Cron Webhooks (`/api/cron`)
| Method | Endpoint                  | Auth          | Description                  |
| ------ | ------------------------- | ------------- | ---------------------------- |
| POST   | `/cron/reminders`         | `CRON_SECRET` | Trigger student fee reminders|
| POST   | `/cron/unpaid-report`     | `CRON_SECRET` | Trigger admin unpaid report  |
| POST   | `/cron/cumulative-report` | `CRON_SECRET` | Trigger admin cumulative report |

Cron webhooks require the header `x-cron-secret` or query param `?secret=` matching `CRON_SECRET`.

---

## Scheduled Cron Jobs

Three automated email jobs run on a monthly schedule:

| # | Job                       | Schedule                             | Recipient       | Description                                                       |
| - | ------------------------- | ------------------------------------ | --------------- | ----------------------------------------------------------------- |
| 1 | **Student Fee Reminders** | **10th of every month** at 10:00 AM IST | Each unpaid student (with email) | Sends individual fee reminder emails listing batch, amount due, and months overdue |
| 2 | **Admin Unpaid Report**   | **20th of every month** at 10:00 AM IST | `ADMIN_EMAIL`   | Summary email listing all students who haven't paid for the current month with totals |
| 3 | **Admin Cumulative Report** | **Last day of every month** at 6:00 PM IST | `ADMIN_EMAIL` | End-of-month summary of all outstanding dues across all students  |

### September 2026 Example

| Date                 | What happens                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| **Sep 10, 10:00 AM** | Each student who hasn't paid September fees receives a reminder email        |
| **Sep 20, 10:00 AM** | You (admin) receive a report listing all students who still haven't paid     |
| **Sep 30, 6:00 PM**  | You receive a cumulative end-of-month summary of all outstanding dues        |

> **Yes, on the 20th you will receive the unpaid report email** at `ADMIN_EMAIL`, listing every student who hasn't paid for September with their name, phone, batch, fee amount, and how long they've been overdue.

### External Cron (for Render / free hosting)

If your server sleeps on free hosting (e.g., Render), use an external cron service like [cron-job.org](https://cron-job.org) to hit the webhook endpoints:

```
POST https://your-api.onrender.com/api/cron/reminders
POST https://your-api.onrender.com/api/cron/unpaid-report
POST https://your-api.onrender.com/api/cron/cumulative-report
```

Include the header: `x-cron-secret: <your CRON_SECRET value>`

---

## Email Templates

| Email                    | Trigger                          | Sent To         |
| ------------------------ | -------------------------------- | --------------- |
| Admin Login OTP          | Admin login attempt              | Admin email     |
| Student Password Reset OTP| Student forgot password flow    | Student email   |
| Welcome Email            | Admin creates new student account| Student email   |
| Payment Confirmation     | Student submits payment          | Student email   |
| Fee Reminder             | Cron job (10th of month)         | Unpaid students |
| Unpaid Report            | Cron job (20th of month)         | Admin email     |
| Cumulative Report        | Cron job (last day of month)     | Admin email     |

---

## Seed Script

```bash
npm run seed
```

Creates:
- **1 Admin account** using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`
- **7 Batch records** (Prarambhik through Visharad Poorna) with default fee of ₹1500

---

## Deployment

The backend is designed for **Render** (Web Service):

1. Set the **Build Command** to `npm install`
2. Set the **Start Command** to `npm start`
3. Add all environment variables from `.env.example`
4. Set `CLIENT_URLS` to your deployed frontend URLs (comma-separated)
5. Set up external cron jobs if using the free tier (server may sleep)
