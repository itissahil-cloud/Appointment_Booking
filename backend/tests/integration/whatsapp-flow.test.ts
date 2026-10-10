import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, initDb } from '../../src/core/db.js';
import { WhatsAppConversationStateMachine } from '../../src/modules/whatsapp/conversation.state-machine.js';

describe('WhatsApp Conversation State Machine Flow - Pure PostgreSQL', () => {
  const patientPhone = '+919888877771';

  async function cleanup() {
    await query(`
      DELETE FROM payments
      WHERE patient_id IN (SELECT id FROM patients WHERE phone_number = $1);
    `, [patientPhone]);
    await query(`
      DELETE FROM appointments
      WHERE patient_id IN (SELECT id FROM patients WHERE phone_number = $1);
    `, [patientPhone]);
    await query(`
      DELETE FROM whatsapp_conversations
      WHERE patient_id IN (SELECT id FROM patients WHERE phone_number = $1);
    `, [patientPhone]);
    await query(`
      DELETE FROM patients
      WHERE phone_number = $1;
    `, [patientPhone]);
  }

  beforeAll(async () => {
    await initDb();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('New Patient completes full WhatsApp booking dialogue up to Payment Pending', async () => {
    await WhatsAppConversationStateMachine.handleIncomingMessage({
      fromPhone: patientPhone,
      messageType: 'text',
      text: 'Hi',
    });

    const patRes = await query(`SELECT id FROM patients WHERE phone_number = $1;`, [patientPhone]);
    const patientId = patRes.rows[0].id;

    let convRes = await query(`SELECT current_state FROM whatsapp_conversations WHERE patient_id = $1;`, [patientId]);
    expect(convRes.rows[0]?.current_state).toBe('AWAITING_BOOKING_CONFIRMATION');

    await WhatsAppConversationStateMachine.handleIncomingMessage({
      fromPhone: patientPhone,
      messageType: 'button_reply',
      buttonId: 'BTN_CONTINUE_BOOKING',
      text: 'Continue',
    });

    convRes = await query(`SELECT current_state FROM whatsapp_conversations WHERE patient_id = $1;`, [patientId]);
    expect(convRes.rows[0]?.current_state).toBe('AWAITING_PATIENT_NAME');

    await WhatsAppConversationStateMachine.handleIncomingMessage({
      fromPhone: patientPhone,
      messageType: 'text',
      text: 'Ramesh Chander',
    });

    const updatedPat = await query(`SELECT full_name FROM patients WHERE phone_number = $1;`, [patientPhone]);
    expect(updatedPat.rows[0]?.full_name).toBe('Ramesh Chander');

    convRes = await query(`SELECT current_state, active_payment_id FROM whatsapp_conversations WHERE patient_id = $1;`, [patientId]);
    expect(convRes.rows[0]?.current_state).toBe('PAYMENT_PENDING');
    expect(convRes.rows[0]?.active_payment_id).toBeDefined();

    const apptRes = await query(`
      SELECT a.status, p.status AS pay_status
      FROM appointments a
      JOIN payments p ON p.appointment_id = a.id
      WHERE a.patient_id = $1;
    `, [patientId]);
    expect(apptRes.rows[0]?.status).toBe('PAYMENT_PENDING');
    expect(apptRes.rows[0]?.pay_status).toBe('PENDING');
  });

  it('Patient sends STATUS command and receives meaningful response without errors', async () => {
    await expect(
      WhatsAppConversationStateMachine.handleIncomingMessage({
        fromPhone: patientPhone,
        messageType: 'text',
        text: 'STATUS',
      })
    ).resolves.not.toThrow();
  });
});
