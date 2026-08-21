import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_TEXT_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_VISION_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_FAST_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_REASONING_MODEL: z.string().default('gemini-3.5-flash'),
  CONVEX_URL: z.string().url().optional(),
  CONVEX_DEPLOYMENT: z.string().optional(),
  AGENT_GATEWAY_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  IMAGE_PROVIDER_API_KEY: z.string().optional(),
  IMAGE_PROVIDER_ENDPOINT: z.string().url().optional(),
  VIDEO_PROVIDER_API_KEY: z.string().optional(),
  VIDEO_PROVIDER_ENDPOINT: z.string().url().optional(),
  AUDIO_PROVIDER_API_KEY: z.string().optional(),
  AUDIO_PROVIDER_ENDPOINT: z.string().url().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  ADMIN_SECRET: z.string().min(16).optional(),
  WORKER_ENABLED: z.coerce.boolean().default(false),
  WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_MAX_POLLS: z.coerce.number().int().positive().default(120)
});

export const config = schema.parse(process.env);
