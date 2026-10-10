import bcrypt from 'bcryptjs';
import { pool, query, initDb } from '../core/db.js';
import { resetAndInitTables } from './init.js';
import { logger } from '../core/logger.js';

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting native PostgreSQL database seeding...');

  await initDb();
  await resetAndInitTables();

  // 1. Seed Clinic Settings
  await query(`
    INSERT INTO clinic_settings (
      id, clinic_name, doctor_name, booking_amount_paisa,
      daily_token_limit, working_days, clinic_open_time,
      clinic_close_time, booking_open_time, cancellation_cutoff_hours,
      is_booking_enabled, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000001', 'S K Poddar neurological clinic', 'Dr. S K Poddar',
      10000, 30, '{1, 2, 3, 4, 5, 6}', '09:00', '17:00', '00:00', 2, TRUE, NOW()
    ) ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Clinic settings seeded');

  // 2. Seed Admin / Doctor User
  const passwordHash = await bcrypt.hash('Admin@Clinic2026!', 10);
  const adminRes = await query(`
    INSERT INTO admin_users (email, password_hash, full_name, role, is_active)
    VALUES ('doctor@skpoddarclinic.com', $1, 'Dr. S K Poddar', 'DOCTOR', TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = $1
    RETURNING id;
  `, [passwordHash]);
  const adminId = adminRes.rows[0]?.id;
  console.log('✅ Admin user seeded: doctor@skpoddarclinic.com');

  // 3. Seed Sample Holiday (15 days ahead)
  const holidayDate = new Date();
  holidayDate.setDate(holidayDate.getDate() + 15);
  const holidayDateStr = holidayDate.toISOString().split('T')[0];

  await query(`
    INSERT INTO clinic_holidays (holiday_date, reason)
    VALUES ($1, 'National Holiday (Clinic Closed)')
    ON CONFLICT (holiday_date) DO NOTHING;
  `, [holidayDateStr]);
  console.log(`✅ Sample holiday seeded for: ${holidayDateStr}`);

  // 4. Seed Sample Patients
  const patientsData = [
    { fullName: 'Rahul Kumar', phoneNumber: '+919876543210', email: 'rahul.kumar@example.com' },
    { fullName: 'Priya Sharma', phoneNumber: '+919876543211', email: 'priya.sharma@example.com' },
    { fullName: 'Amit Patel', phoneNumber: '+919876543212', email: 'amit.patel@example.com' },
    { fullName: 'Sneha Verma', phoneNumber: '+919876543213', email: 'sneha.verma@example.com' },
    { fullName: 'Vikram Singh', phoneNumber: '+919876543214', email: 'vikram.singh@example.com' },
  ];

  const patientIds: string[] = [];
  for (const p of patientsData) {
    const res = await query(`
      INSERT INTO patients (full_name, phone_number, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (phone_number) DO UPDATE SET full_name = $1
      RETURNING id;
    `, [p.fullName, p.phoneNumber, p.email]);
    const pId = res.rows[0].id;
    patientIds.push(pId);

    // Ensure conversation record exists
    await query(`
      INSERT INTO whatsapp_conversations (patient_id, current_state)
      VALUES ($1, 'IDLE')
      ON CONFLICT (patient_id) DO NOTHING;
    `, [pId]);
  }
  console.log(`✅ Seeded ${patientIds.length} sample patients`);

  // 5. Seed Daily Token Counter and Sample Queue for Today
  const todayStr = new Date().toISOString().split('T')[0];

  await query(`
    INSERT INTO daily_token_counters (appointment_date, last_token)
    VALUES ($1, 5)
    ON CONFLICT (appointment_date) DO UPDATE SET last_token = 5;
  `, [todayStr]);

  const statuses = ['COMPLETED', 'COMPLETED', 'IN_PROGRESS', 'CONFIRMED', 'CONFIRMED'];

  for (let i = 0; i < 5; i++) {
    const token = i + 1;
    const pId = patientIds[i];
    const status = statuses[i];

    const apptRes = await query(`
      INSERT INTO appointments (patient_id, appointment_date, token_number, status, completed_at)
      VALUES ($1, $2, $3, $4::appointment_status, $5)
      ON CONFLICT (appointment_date, token_number) DO UPDATE SET status = $4::appointment_status
      RETURNING id;
    `, [
      pId,
      todayStr,
      token,
      status,
      status === 'COMPLETED' ? new Date() : null,
    ]);
    const apptId = apptRes.rows[0].id;

    await query(`
      INSERT INTO payments (
        appointment_id, patient_id, amount_paisa, status,
        provider, provider_order_id, provider_transaction_id,
        verified_at, expires_at
      ) VALUES (
        $1, $2, 10000, 'SUCCESS', 'HDFC',
        $3, $4, NOW(), NOW() + INTERVAL '15 minutes'
      ) ON CONFLICT (provider_order_id) DO NOTHING;
    `, [
      apptId,
      pId,
      `HDFC_ORD_${todayStr}_TK${token}`,
      `HDFC_TXN_${todayStr}_TK${token}`,
    ]);
  }

  // 6. Seed Doctor Note
  if (adminId && patientIds[0]) {
    await query(`
      INSERT INTO patient_notes (patient_id, admin_user_id, note)
      VALUES ($1, $2, 'Routine follow-up. Blood pressure normal. Advised lifestyle maintenance.');
    `, [patientIds[0], adminId]);
  }

  console.log('✅ Today queue & payments seeded successfully');
  console.log('🎉 Native PostgreSQL database seeding completed!');
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
