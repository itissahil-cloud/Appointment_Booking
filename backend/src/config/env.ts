import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or backend directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  COOKIE_SECRET: z.string().default('clinic_cookie_secret_2026'),

  WHATSAPP_ACCESS_TOKEN: z.string().default('mock_whatsapp_access_token'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default('mock_phone_number_id'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default('mock_business_account_id'),
  WHATSAPP_VERIFY_TOKEN: z.string().default('clinic_verify_token_123'),
  WHATSAPP_APP_SECRET: z.string().default('mock_meta_app_secret'),

  HDFC_MERCHANT_ID: z.string().default('MOCK_HDFC_MERCHANT'),
  HDFC_API_KEY: z.string().default('mock_hdfc_api_key'),
  HDFC_SECRET: z.string().default('mock_hdfc_secret'),
  HDFC_BASE_URL: z.string().default('https://smartgatewayuat.hdfcbank.com'),
  HDFC_WEBHOOK_SECRET: z.string().default('mock_webhook_secret_key'),
  HDFC_RETURN_URL: z.string().default('http://localhost:3000/payment-status'),

  USE_MOCK_PAYMENT: z.coerce.boolean().default(true),
  USE_MOCK_WHATSAPP: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
