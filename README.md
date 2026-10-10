# Dr. Sharma Clinic - Appointment & FCFS Token Booking System

Production-ready appointment booking system for a single-doctor clinic. Patients book through **WhatsApp**, appointments are ordered via a **First-Come, First-Served (FCFS) token queue** (without individual time slots), and tokens are generated **strictly after verified payment through HDFC Payment Gateway**. Includes a secure **Admin/Doctor Web Panel** with live queue calling and clinic management.

---

## 1. Key Architectural Features

- **WhatsApp Cloud API Integration**: Automated conversational bot supporting booking, instant date checking, queue order tracking (`STATUS`), and cancellations (`CANCEL`).
- **Payment-First Token Engine**: Tokens are generated **only after** server-to-server payment verification from HDFC. An unverified or failed payment never consumes a token.
- **Atomic FCFS Queue (PostgreSQL Row-Locking)**: Concurrency-hardened with `SELECT ... FOR UPDATE` inside an ACID transaction to guarantee strictly sequential, collision-free tokens under simultaneous payment callbacks.
- **Idempotent Webhook Processing**: Replayed payment callbacks or duplicate webhook retries safely return existing tokens without creating duplicates.
- **Dynamic Clinic Calendar**: Automatically calculates the next bookable working day, bypassing configured off-days (e.g., Sundays) and official clinic holidays.
- **Single Appointment Per Day Policy**: Prevents patients from holding multiple simultaneous slots on the same clinic day.
- **Doctor / Admin Web Console**: Next.js responsive dashboard featuring real-time queue view, single-click *"Call Next Patient"* with WhatsApp alerting, patient medical history, private clinical notes, transaction logs, and holiday management.

---

## 2. Technology Stack

- **Backend**: Node.js, TypeScript, Express (Modular Monolith architecture)
- **Database**: PostgreSQL 16, Prisma ORM
- **Security & Auth**: Argon2/bcrypt password hashing, JWT in HTTP-only SameSite cookies, Express Rate Limiting, Helmet, Structured PII-masked JSON logging
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Infrastructure**: Docker & Docker Compose

---

## 3. Directory Layout

```
├── docker-compose.yml              # PostgreSQL + Backend + Frontend
├── .env.example                    # Template environment variables
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Prisma models & constraints
│   │   └── seed.ts                 # Dev seed script (doctor, patients, queue)
│   ├── src/
│   │   ├── config/                 # Zod validated configuration
│   │   ├── core/                   # Logger (PII masking), DB singleton
│   │   ├── modules/
│   │   │   ├── auth/               # Admin login, sessions, rate limiter
│   │   │   ├── clinic-settings/    # Working days, token limit, date calculator
│   │   │   ├── holidays/           # Holiday calendar management
│   │   │   ├── patients/           # Patient lookup, normalizer, notes
│   │   │   ├── appointments/       # Booking & status management
│   │   │   ├── tokens/             # Atomic FCFS row-level lock engine
│   │   │   ├── payments/           # PaymentProvider interface & HDFC adapter
│   │   │   ├── whatsapp/           # Meta Cloud API & state machine
│   │   │   ├── queue/              # Doctor live queue & "Call Next" logic
│   │   │   └── audit-logs/         # Security & administrative audit trail
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # Server entrypoint
│   └── tests/
│       ├── unit/                   # Next working day & holiday tests
│       ├── integration/            # Business rules & WhatsApp dialogue tests
│       └── concurrency/            # 50-100 parallel payment race condition test
└── frontend/
    └── src/
        ├── app/
        │   ├── (auth)/login/       # Secure doctor login
        │   ├── (dashboard)/        # Live queue, patients, payments, settings
        │   └── mock-payment/       # HDFC Gateway simulator sandbox
        └── lib/api.ts              # Type-safe API client
```

---

## 4. Quick Start (Local Setup)

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### Step 1: Start PostgreSQL Database
```bash
docker compose up -d postgres
```

### Step 2: Set Up Backend
```bash
cd backend
npm install

# Push database schema & generate Prisma Client
npx prisma db push

# Seed initial clinic settings, doctor account, and sample queue
npm run prisma:seed
```

### Step 3: Run Automated Test Suite
Run all unit, integration, and concurrency tests:
```bash
npm test
```
*Includes the mandatory FCFS concurrency test simulating 50 simultaneous parallel payments with 0 duplicate tokens.*

### Step 4: Run Application
In one terminal, start the backend (port 4000):
```bash
cd backend
npm run dev
```

In another terminal, start the frontend (port 3000):
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Default Credentials

- **Doctor Email**: `doctor@sharmaclinic.com`
- **Password**: `Admin@Clinic2026!`

---

## 6. How to Test the Complete End-to-End Flow

### 1. Simulated WhatsApp Dialogue & Booking
You can trigger inbound WhatsApp events via `POST /api/webhooks/whatsapp` or use the automated test `npm test`:
- Patient sends `"Hi"` $\to$ Bot calculates next available date and asks to book.
- Patient clicks `[Continue]` $\to$ Name requested (if new patient).
- Patient enters name $\to$ HDFC Payment order created, link sent.

### 2. Complete Payment via HDFC Sandbox
Navigate to [http://localhost:3000/mock-payment](http://localhost:3000/mock-payment) in your browser.
- Enter the Order ID generated.
- Click **"Pay ₹100 (Success)"**.
- The server verifies the callback, locks the date counter, assigns the next sequential FCFS token (e.g. `#1`, `#2`...), and marks the appointment `CONFIRMED`.

### 3. Doctor Chamber Queue Management
Log in to the Admin Dashboard at [http://localhost:3000/dashboard](http://localhost:3000/dashboard):
- View today's registered patients with token numbers.
- Click **"Call Next Patient"** to advance the queue from `WAITING` $\to$ `IN_PROGRESS` and send a WhatsApp alert to the patient.
- Add private clinical consultation notes under the **Patients Directory**.

---

## 7. HDFC Payment Gateway Integration Notes

In accordance with Section 59 of the project specification:
- The system employs a clean `PaymentProvider` abstraction (`backend/src/modules/payments/payment.interface.ts`).
- `HdfcPaymentProvider` is pre-wired to read all credentials from environment variables (`HDFC_MERCHANT_ID`, `HDFC_API_KEY`, `HDFC_SECRET`, `HDFC_BASE_URL`, `HDFC_WEBHOOK_SECRET`, `HDFC_RETURN_URL`).
- To switch from the sandbox simulator to live HDFC gateway once credentials/docs are supplied, set:
  ```env
  USE_MOCK_PAYMENT="false"
  ```
- All payment callbacks verify server-to-server authenticity before triggering token assignment.

---

## 8. Meta WhatsApp Cloud API Setup

1. In the [Meta for Developers Console](https://developers.facebook.com/), create a WhatsApp Business App.
2. In Webhooks configuration:
   - **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp`
   - **Verify Token**: Match `WHATSAPP_VERIFY_TOKEN` in `.env`.
   - **Fields**: Subscribe to `messages`.
3. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_APP_SECRET` in `.env`.
4. Switch `USE_MOCK_WHATSAPP="false"` in `.env` to enable real messaging.

---

## 9. API Reference

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public | Admin/doctor login with rate limiting |
| `/api/auth/logout` | `POST` | Admin | Clears session cookie |
| `/api/auth/me` | `GET` | Admin | Gets authenticated doctor profile |
| `/api/dashboard` | `GET` | Admin | Current token, queue breakdown, and revenue |
| `/api/queue/today` | `GET` | Admin | Live ordered FCFS token queue |
| `/api/queue/next` | `POST` | Admin | Advances queue and alerts called patient |
| `/api/patients` | `GET` | Admin | Search patients with visit counts |
| `/api/patients/:id` | `GET` | Admin | Patient appointment history & private notes |
| `/api/patients/:id/notes` | `POST` | Admin | Add doctor-only confidential note |
| `/api/appointments` | `GET` | Admin | Filter appointments by date/status |
| `/api/appointments/:id/complete` | `POST` | Admin | Mark consultation completed |
| `/api/payments` | `GET` | Admin | List payment transactions & statuses |
| `/api/payments/:id/reconcile` | `POST` | Admin | Server-to-server HDFC reconciliation |
| `/api/settings` | `GET / PATCH` | Admin | Working days, token limit, consultation fee |
| `/api/holidays` | `GET / POST` | Admin | Clinic holiday calendar |
| `/api/audit-logs` | `GET` | Admin | Audit trail of administrative actions |
| `/api/webhooks/whatsapp` | `GET` | Meta | Webhook challenge verification |
| `/api/webhooks/whatsapp` | `POST` | Meta | Inbound message and button replies |
| `/api/webhooks/payment/hdfc` | `POST` | HDFC | Payment gateway callback |
| `/api/payments/mock/pay` | `POST` | Dev | HDFC sandbox checkout simulator |

---

## 10. Concurrency & Integrity Proof

The atomic token allocation is protected using PostgreSQL row-level locks:
```sql
SELECT last_token FROM daily_token_counters 
WHERE appointment_date = $1::date FOR UPDATE;
```
Run `npm test` in `backend/` to see the automated concurrency suite verify 50 concurrent transactions without a single race condition, duplicate token, or missing slot.
