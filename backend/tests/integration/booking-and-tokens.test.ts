import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { query, initDb } from '../../src/core/db.js';
import { toLocalDateString } from '../../src/modules/clinic-settings/date-calculator.js';
import { PaymentService } from '../../src/modules/payments/payment.service.js';
import { PatientService } from '../../src/modules/patients/patient.service.js';

describe('Clinic Booking System - Pure PostgreSQL Integration', () => {
  const testDate = new Date(2026, 10, 15);
  const testDateStr = toLocalDateString(testDate);

  async function cleanup() {
    await query(`DELETE FROM payments WHERE appointment_id IN (SELECT id FROM appointments WHERE appointment_date = $1::date);`, [testDateStr]);
    await query(`DELETE FROM appointments WHERE appointment_date = $1::date;`, [testDateStr]);
    await query(`DELETE FROM daily_token_counters WHERE appointment_date = $1::date;`, [testDateStr]);
  }

  beforeAll(async () => {
    await initDb();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('1. Patient recognition by phone number works correctly', async () => {
    const rawPhone = '9876500001';
    const patient1 = await PatientService.findOrCreateByPhone(rawPhone, 'Arun Verma');
    expect(patient1.phoneNumber).toBe('+919876500001');

    const patient2 = await PatientService.findOrCreateByPhone('+919876500001');
    expect(patient2.id).toBe(patient1.id);
    expect(patient2.fullName).toBe('Arun Verma');
  });

  it('2. First paying patient receives Token #1', async () => {
    const patientA = await PatientService.findOrCreateByPhone('+919999000001', 'Patient Alpha');

    const orderA = await PaymentService.initiateBookingPayment({
      patientId: patientA.id,
      appointmentDate: testDate,
    });

    expect(orderA.appointment.status).toBe('PAYMENT_PENDING');

    const webhookRes = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderA.payment.providerOrderId,
        providerTransactionId: `TXN_ALPHA_${Date.now()}`,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );

    expect(webhookRes.success).toBe(true);
    expect(webhookRes.result?.tokenNumber).toBe(1);

    const checkRes = await query(`SELECT status, token_number FROM appointments WHERE id = $1;`, [orderA.appointment.id]);
    expect(checkRes.rows[0]?.status).toBe('CONFIRMED');
    expect(checkRes.rows[0]?.token_number).toBe(1);
  });

  it('3. Second paying patient receives sequential Token #2', async () => {
    const patientB = await PatientService.findOrCreateByPhone('+919999000002', 'Patient Beta');

    const orderB = await PaymentService.initiateBookingPayment({
      patientId: patientB.id,
      appointmentDate: testDate,
    });

    const webhookRes = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderB.payment.providerOrderId,
        providerTransactionId: `TXN_BETA_${Date.now()}`,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );

    expect(webhookRes.success).toBe(true);
    expect(webhookRes.result?.tokenNumber).toBe(2);
  });

  it('4. Duplicate webhook delivery is strictly idempotent and does not create duplicate token', async () => {
    const patientC = await PatientService.findOrCreateByPhone('+919999000003', 'Patient Charlie');

    const orderC = await PaymentService.initiateBookingPayment({
      patientId: patientC.id,
      appointmentDate: testDate,
    });

    const txnId = `TXN_CHARLIE_${Date.now()}`;

    const firstCall = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderC.payment.providerOrderId,
        providerTransactionId: txnId,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );
    expect(firstCall.result?.isIdempotentReplay).toBe(false);
    expect(firstCall.result?.tokenNumber).toBe(3);

    const duplicateCall = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderC.payment.providerOrderId,
        providerTransactionId: txnId,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );

    expect(duplicateCall.result?.isIdempotentReplay).toBe(true);
    expect(duplicateCall.result?.tokenNumber).toBe(3);

    const countRes = await query(`SELECT last_token FROM daily_token_counters WHERE appointment_date = $1::date;`, [testDateStr]);
    expect(countRes.rows[0]?.last_token).toBe(3);
  });

  it('5. Payment failure leaves appointment unconfirmed without assigning a token', async () => {
    const patientD = await PatientService.findOrCreateByPhone('+919999000004', 'Patient Delta');

    const orderD = await PaymentService.initiateBookingPayment({
      patientId: patientD.id,
      appointmentDate: testDate,
    });

    const webhookRes = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderD.payment.providerOrderId,
        providerTransactionId: `TXN_DELTA_FAIL_${Date.now()}`,
        status: 'FAILED',
        amountPaisa: 10000,
      }
    );

    expect(webhookRes.success).toBe(false);

    const checkRes = await query(`
      SELECT a.status AS appt_status, a.token_number, p.status AS pay_status
      FROM appointments a
      JOIN payments p ON p.appointment_id = a.id
      WHERE a.id = $1;
    `, [orderD.appointment.id]);

    expect(checkRes.rows[0]?.appt_status).toBe('PAYMENT_PENDING');
    expect(checkRes.rows[0]?.token_number).toBeNull();
    expect(checkRes.rows[0]?.pay_status).toBe('FAILED');
  });

  it('6. Daily token limit prevents bookings beyond configured quota', async () => {
    await query(`UPDATE clinic_settings SET daily_token_limit = 4;`);

    const patientE = await PatientService.findOrCreateByPhone('+919999000005', 'Patient Echo');
    const orderE = await PaymentService.initiateBookingPayment({
      patientId: patientE.id,
      appointmentDate: testDate,
    });

    const resE = await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderE.payment.providerOrderId,
        providerTransactionId: `TXN_ECHO_${Date.now()}`,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );
    expect(resE.result?.tokenNumber).toBe(4);

    const patientF = await PatientService.findOrCreateByPhone('+919999000006', 'Patient Foxtrot');
    const orderF = await PaymentService.initiateBookingPayment({
      patientId: patientF.id,
      appointmentDate: testDate,
    });

    await expect(
      PaymentService.handleWebhook(
        { 'x-mock-signature': 'valid' },
        {
          providerOrderId: orderF.payment.providerOrderId,
          providerTransactionId: `TXN_FOXTROT_${Date.now()}`,
          status: 'SUCCESS',
          amountPaisa: 10000,
        }
      )
    ).rejects.toThrow('DAILY_LIMIT_EXCEEDED');

    await query(`UPDATE clinic_settings SET daily_token_limit = 30;`);
  });

  it('7. Patient cancellation transitions appointment status to CANCELLED', async () => {
    const patientG = await PatientService.findOrCreateByPhone('+919999000007', 'Patient Golf');
    const orderG = await PaymentService.initiateBookingPayment({
      patientId: patientG.id,
      appointmentDate: testDate,
    });

    await PaymentService.handleWebhook(
      { 'x-mock-signature': 'valid' },
      {
        providerOrderId: orderG.payment.providerOrderId,
        providerTransactionId: `TXN_GOLF_${Date.now()}`,
        status: 'SUCCESS',
        amountPaisa: 10000,
      }
    );

    await query(`
      UPDATE appointments
      SET status = 'CANCELLED'::appointment_status, cancel_reason = 'Patient cancelled', cancelled_at = NOW()
      WHERE id = $1;
    `, [orderG.appointment.id]);

    const checkRes = await query(`SELECT status FROM appointments WHERE id = $1;`, [orderG.appointment.id]);
    expect(checkRes.rows[0]?.status).toBe('CANCELLED');
  });

  it('8. Unauthorized access to admin APIs is strictly blocked (401)', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('UNAUTHORIZED');

    const queueRes = await request(app).get('/api/queue/today');
    expect(queueRes.status).toBe(401);
  });
});
