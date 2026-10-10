import fs from 'fs';
import path from 'path';
import { query, pool } from '../core/db.js';

export async function resetAndInitTables(): Promise<void> {
  console.log('🔄 Re-creating fresh pure PostgreSQL schema...');

  // Reset schema to cleanly remove all Prisma artifacts
  await query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO clinic_admin;
    GRANT ALL ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await query(sql);

  console.log('✅ Fresh pure PostgreSQL schema initialized!');
}

if (process.argv[1]?.includes('init')) {
  resetAndInitTables()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
