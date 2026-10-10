import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, initDb } from '../../src/core/db.js';
import { toLocalDateString } from '../../src/modules/clinic-settings/date-calculator.js';
import { PaymentService } from '../../src/modules/payments/payment.service.js';
import { PatientService } from '../../src/modules/patients/patient.service.js';

describe('Mandatory Concurrency Test - Native PostgreSQL FCFS Atomic Row-Locking Token Engine', () => {
  const concurrencyDate = new Date(2026, 11, 1);
  const concurrencyDateStr = toLocalDateString(concurrencyDate);
  const CONCURRENT_PATIENTS_COUNT = 50;

  async function cleanup() {
    await query(`DELETE FROM payments WHERE appointment_id IN (SELECT id FROM appointments WHERE appointment_date = $1::date);`, [concurrencyDateStr]);
    await query(`DELETE FROM appointments WHERE appointment_date = $1::date;`, [concurrencyDateStr]);
    await query(`DELETE FROM daily_token_counters WHERE appointment_date = $1::date;`, [concurrencyDateStr]);
  }

  beforeAll(async () => {
    await initDb();
    await query(`UPDATE clinic_settings SET daily_token_limit = 150;`);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await query(`UPDATE clinic_settings SET daily_token_limit = 30;`);
  });

  it(`Atomically allocates exactly 1..${CONCURRENT_PATIENTS_COUNT} unique sequential tokens under concurrent load without duplicates or gaps`, async () => {
    console.log(`🚀 Preparing ${CONCURRENT_PATIENTS_COUNT} patients and payment orders...`);

    const orderPromises = Array.from({ length: CONCURRENT_PATIENTS_COUNT }, async (_, i) => {
      const phone = `+9170000000${String(i + 1).padStart(2, '0')}`;
      const patient = await PatientService.findOrCreateByPhone(phone, `Concurrent Patient ${i + 1}`);
      const order = await PaymentService.initiateBookingPayment({
        patientId: patient.id,
        appointmentDate: concurrencyDate,
      });
      return {
        patient,
        order,
        providerOrderId: order.payment.providerOrderId,
        providerTransactionId: `CONCUR_TXN_${i + 1}_${Date.now()}`,
      };
    });

    const orders = await Promise.all(orderPromises);
    expect(orders.length).toBe(CONCURRENT_PATIENTS_COUNT);

    console.log(`⚡ Firing ${CONCURRENT_PATIENTS_COUNT} simultaneous webhook payment confirmations...`);

    const webhookConfirmations = orders.map((o) =>
      PaymentService.handleWebhook(
        { 'x-mock-signature': 'valid' },
        {
          providerOrderId: o.providerOrderId,
          providerTransactionId: o.providerTransactionId,
          status: 'SUCCESS',
          amountPaisa: 10000,
        }
      )
    );

    const results = await Promise.all(webhookConfirmations);

    const tokens = results.map((r) => r.result!.tokenNumber);
    expect(tokens.length).toBe(CONCURRENT_PATIENTS_COUNT);

    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(CONCURRENT_PATIENTS_COUNT);

    const sortedTokens = [...tokens].sort((a, b) => a - b);
    for (let i = 0; i < CONCURRENT_PATIENTS_COUNT; i++) {
      expect(sortedTokens[i]).toBe(i + 1);
    }

    const countRes = await query(`SELECT last_token FROM daily_token_counters WHERE appointment_date = $1::date;`, [concurrencyDateStr]);
    expect(countRes.rows[0]?.last_token).toBe(CONCURRENT_PATIENTS_COUNT);

    console.log(`✅ Pure PostgreSQL Concurrency test passed: ${CONCURRENT_PATIENTS_COUNT} tokens assigned monotonically 1..${CONCURRENT_PATIENTS_COUNT} with 0 collisions.`);
  }, 60000);
});
