-- ==============================================================================
-- Pure PostgreSQL Schema DDL for Clinic Appointment & FCFS Token Booking
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'PAYMENT_PENDING',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED',
    'EXPIRED',
    'REFUNDED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_conversation_state AS ENUM (
    'IDLE',
    'AWAITING_BOOKING_CONFIRMATION',
    'AWAITING_PATIENT_NAME',
    'PAYMENT_PENDING',
    'AWAITING_CANCEL_CONFIRMATION'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'ADMIN_LOGIN',
    'ADMIN_LOGOUT',
    'APPOINTMENT_CALL_NEXT',
    'APPOINTMENT_MARK_IN_PROGRESS',
    'APPOINTMENT_MARK_COMPLETED',
    'APPOINTMENT_MARK_NO_SHOW',
    'APPOINTMENT_CANCELLED',
    'SETTINGS_UPDATED',
    'HOLIDAY_CREATED',
    'HOLIDAY_DELETED',
    'PATIENT_NOTE_ADDED',
    'MANUAL_RECONCILIATION'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'DOCTOR',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);

-- 3. Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  token_number INT,
  status appointment_status DEFAULT 'PAYMENT_PENDING',
  cancel_reason VARCHAR(255),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_token_per_date UNIQUE (appointment_date, token_number)
);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- 4. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount_paisa INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status payment_status DEFAULT 'PENDING',
  provider VARCHAR(50) DEFAULT 'HDFC',
  provider_order_id VARCHAR(100) UNIQUE NOT NULL,
  provider_transaction_id VARCHAR(100) UNIQUE,
  payment_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  raw_webhook_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_txn_id ON payments(provider_transaction_id);

-- 5. Daily Token Counters (target of PostgreSQL SELECT ... FOR UPDATE)
CREATE TABLE IF NOT EXISTS daily_token_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_date DATE UNIQUE NOT NULL,
  last_token INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Clinic Settings
CREATE TABLE IF NOT EXISTS clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name VARCHAR(100) DEFAULT 'Dr. Sharma Clinic',
  doctor_name VARCHAR(100) DEFAULT 'Dr. Sharma',
  booking_amount_paisa INT DEFAULT 10000,
  daily_token_limit INT DEFAULT 30,
  working_days INT[] DEFAULT '{1, 2, 3, 4, 5, 6}',
  clinic_open_time VARCHAR(5) DEFAULT '09:00',
  clinic_close_time VARCHAR(5) DEFAULT '17:00',
  booking_open_time VARCHAR(5) DEFAULT '00:00',
  cancellation_cutoff_hours INT DEFAULT 2,
  is_booking_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Clinic Holidays
CREATE TABLE IF NOT EXISTS clinic_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE UNIQUE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Patient Confidential Notes (Doctor only)
CREATE TABLE IF NOT EXISTS patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON patient_notes(patient_id);

-- 9. WhatsApp Conversations
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  current_state whatsapp_conversation_state DEFAULT 'IDLE',
  pending_booking_date DATE,
  active_payment_id UUID,
  last_interaction_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
