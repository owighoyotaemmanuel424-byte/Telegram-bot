# Gemini Telegram AI Media Assistant

A production-oriented Telegram AI agent using Gemini as the reasoning/orchestration layer and Convex as the persistent application database.

## Core capabilities

- Natural-language Telegram chat
- Gemini multimodal image/audio/document context
- Gemini function calling with tool-result feedback
- Persistent conversations and active media context
- Image generation and editing through a configurable provider
- Image-to-video and text-to-video through a configurable provider
- Voice generation and transcription through a configurable audio provider
- Asynchronous Convex job queue with credit reservation/refund boundaries
- Background worker polling with Telegram progress updates
- S3-compatible media storage and short-lived signed URLs
- Provider abstraction so media vendors can be replaced without changing Gemini orchestration
- Telegram webhook authentication, payload limits and basic rate limiting
- Admin provider configuration foundation
- Health endpoint and CI type/build validation

## Architecture

```text
Telegram
   |
Webhook API -- immediate 200
   |
Convex user/conversation/media context
   |
Gemini multimodal agent
   |
Function calling + tool results
   |
Convex job queue + atomic credit reservation
   |
Background worker
   |
Image / Video / Audio providers
   |
S3-compatible storage
   |
Telegram delivery
```

## Production processes

Run the web process and worker separately:

```bash
npm install
npm run build
npm start
npm run start:worker
```

The web process must never perform long-running video generation inside the Telegram webhook. The worker claims queued jobs and performs provider polling asynchronously.

## Convex

Deploy Convex before enabling production jobs:

```bash
npm run convex:codegen
npm run convex:deploy
```

Set `AGENT_GATEWAY_SECRET` in both the Convex deployment and Node/worker environment. Backend `/agent/jobs/*` routes require the matching secret.

## Providers

The repository uses a common provider contract. Configure real provider endpoints; the application does not fabricate successful media results.

### Video

`VIDEO_PROVIDER_ENDPOINT` + `VIDEO_PROVIDER_API_KEY`

### Image

`IMAGE_PROVIDER_ENDPOINT` + `IMAGE_PROVIDER_API_KEY`

### Audio / voice / transcription

`AUDIO_PROVIDER_ENDPOINT` + `AUDIO_PROVIDER_API_KEY`

Each generic provider expects:

- `POST /` with `{ operation, prompt, assets, options }`
- `GET /:providerJobId`
- Response `{ id|providerJobId, status, progress?, outputAssets?, error? }`

Provider-specific adapters can be substituted without changing the Telegram/Gemini layer.

## Environment

Copy `.env.example` to your secret manager/environment. Never commit credentials.

Important variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`
- `GEMINI_VISION_MODEL`
- `GEMINI_FAST_MODEL`
- `GEMINI_REASONING_MODEL`
- `CONVEX_URL`
- `AGENT_GATEWAY_SECRET`
- `STORAGE_ENDPOINT`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- provider API keys/endpoints
- `ADMIN_SECRET`

## Telegram webhook

Expose the Node server through HTTPS and configure Telegram to POST updates to:

`/api/telegram/webhook`

Use the same random `TELEGRAM_WEBHOOK_SECRET` in Telegram and the application environment.

## Security

- Rotate any credential that has been exposed in chat, logs, screenshots, or commits.
- Keep Gemini, Telegram, storage, provider, payment and Convex secrets server-side.
- Keep `/agent/jobs/*` private behind `AGENT_GATEWAY_SECRET`.
- Use a private S3/R2 bucket and short-lived signed URLs.
- Do not execute arbitrary shell commands from user input.
- Run future FFmpeg/media processing in isolated workers.
- Keep Telegram webhook payload limits and rate limiting enabled.

## Validation

```bash
npm install
npm run convex:codegen
npm run typecheck
npm run build
```

GitHub Actions performs the same dependency installation, Convex code generation, typecheck and production build validation.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the two-process deployment model, environment configuration, webhook setup and production verification checklist.
