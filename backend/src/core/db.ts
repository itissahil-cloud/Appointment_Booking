import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const { Pool } = pg;

// Initialize PostgreSQL connection pool
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 30, // Connection pool size for concurrent FCFS operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

/**
 * Execute parameterized query
 */
export async function query<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    logger.debug(`Slow query (${duration}ms): ${text.slice(0, 100)}`);
  }
  return res;
}

/**
 * Acquire a client for explicit multi-statement transactions (BEGIN / COMMIT / ROLLBACK)
 */
export async function getClient(): Promise<pg.PoolClient> {
  return await pool.connect();
}

/**
 * Automatically applies the PostgreSQL DDL schema
 */
export async function initDb(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(sql);
    logger.info('✅ Native PostgreSQL schema verified & initialized');
  }
}
