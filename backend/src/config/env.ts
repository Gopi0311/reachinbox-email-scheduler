import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().default('http://localhost:5000'),
  SESSION_SECRET: z.string().min(8).default('super-secure-session-secret-change-in-production-reachinbox-2026'),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/reachinbox_scheduler?schema=public'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // Scheduling Defaults
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(100),

  // Ethereal SMTP
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASSWORD: z.string().optional().default(''),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string({ required_error: 'GOOGLE_CLIENT_ID is required' }).min(1, 'GOOGLE_CLIENT_ID cannot be empty'),
  GOOGLE_CLIENT_SECRET: z.string({ required_error: 'GOOGLE_CLIENT_SECRET is required' }).min(1, 'GOOGLE_CLIENT_SECRET cannot be empty'),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string({ required_error: 'SLACK_CLIENT_ID is required' }).min(1, 'SLACK_CLIENT_ID cannot be empty'),
  SLACK_CLIENT_SECRET: z.string({ required_error: 'SLACK_CLIENT_SECRET is required' }).min(1, 'SLACK_CLIENT_SECRET cannot be empty'),
});

const parsed = envSchema.safeParse(process.cwd() ? process.env : {});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
