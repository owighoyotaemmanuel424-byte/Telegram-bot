# Gemini Telegram AI Media Assistant

Production-oriented Telegram AI media agent using Gemini as the orchestration layer and Convex as the persistent application database.

## What is implemented

- Telegram webhook server with natural-language requests
- Gemini multimodal context and function-calling loop
- Persistent Convex users, conversations, messages, assets, jobs, credits, audit logs and provider settings
- S3-compatible media storage integration
- Active-asset and conversation memory
- Image-to-video provider abstraction with asynchronous polling
- Request-scoped job idempotency and credit reservation/refund boundaries
- Authenticated Convex job lifecycle gateway
- Admin provider settings foundation
- Health endpoint
- TypeScript build/typecheck CI

## Architecture

```text
Telegram -> Webhook -> Convex context + media storage -> Gemini
                                              |
                                              v
                                      Tool/function calling
                                              |
                                   Media provider adapters
                                              |
                                      Convex job lifecycle
                                              |
                                     Telegram final response
```

## Required production services

1. A hosted Node.js process for `src/index.ts`.
2. A Convex deployment for the database and HTTP actions.
3. An S3-compatible bucket such as Cloudflare R2, AWS S3, or another compatible service.
4. Gemini API credentials.
5. A real video provider configured through `VIDEO_PROVIDER_ENDPOINT` and `VIDEO_PROVIDER_API_KEY` for image-to-video.

Image, audio, transcription, document and deterministic editing providers remain adapter points; configure and implement the corresponding provider adapters before enabling those operations in production.

## Environment

Copy `.env.example` to `.env` and provide real credentials. Never commit secrets.

Important variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_*_MODEL`
- `CONVEX_URL`
- `AGENT_GATEWAY_SECRET`
- `STORAGE_*`
- `VIDEO_PROVIDER_ENDPOINT`
- `VIDEO_PROVIDER_API_KEY`
- `ADMIN_SECRET`

## Local validation

```bash
npm install
npm run typecheck
npm run build
npm run convex:codegen
npm run convex:deploy
```

## Production webhook

Expose the Node server over HTTPS and route Telegram updates to:

`POST /api/telegram/webhook`

The Telegram webhook secret must be configured as `TELEGRAM_WEBHOOK_SECRET`. The application itself must also have `TELEGRAM_BOT_TOKEN` and `GEMINI_API_KEY` configured.

## Security

- Never place Telegram, Gemini, storage, payment or provider secrets in Git.
- Rotate any credential that has been exposed outside the secret manager.
- Keep `AGENT_GATEWAY_SECRET` private because it authorizes backend job operations.
- Put the admin API behind a secret and HTTPS.
- Enforce Telegram file size/MIME limits before processing untrusted media.
- Run FFmpeg and media workers in isolated infrastructure when adding arbitrary media processing.

## Status

The core agent, multimodal context, Convex persistence, storage integration, function-calling, image-to-video worker and job lifecycle are wired. Actual media generation still requires real provider credentials and provider-specific adapter configuration; the repository does not fake provider results.
