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

## Production deployment

The production deployment is two long-running services:

1. **web** — Telegram webhook, Gemini orchestration, health/admin endpoints.
2. **worker** — claims Convex jobs and performs asynchronous media-provider polling.

Docker images are provided as `Dockerfile` and `Dockerfile.worker`. A local/VM deployment can use:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

For managed container platforms, deploy the same Docker image twice: the web service runs `node dist/index.js`; the worker service runs `node dist/worker.js`.

### Required production variables

Set these as platform secrets/environment variables. Never commit them:

```text
PUBLIC_BASE_URL=https://your-public-https-domain.example
TELEGRAM_BOT_TOKEN=<rotated BotFather token>
TELEGRAM_WEBHOOK_SECRET=<random 16+ character secret>
GEMINI_API_KEY=<Google Gemini API key>
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_VISION_MODEL=gemini-3.5-flash
GEMINI_FAST_MODEL=gemini-3.5-flash
GEMINI_REASONING_MODEL=gemini-3.5-flash
CONVEX_URL=<Convex deployment URL>
AGENT_GATEWAY_SECRET=<random 32+ character secret>
STORAGE_ENDPOINT=<S3-compatible endpoint>
STORAGE_BUCKET=<private bucket>
STORAGE_ACCESS_KEY=<storage access key>
STORAGE_SECRET_KEY=<storage secret>
VIDEO_PROVIDER_ENDPOINT=<real video provider endpoint>
VIDEO_PROVIDER_API_KEY=<real video provider key>
IMAGE_PROVIDER_ENDPOINT=<real image provider endpoint>
IMAGE_PROVIDER_API_KEY=<real image provider key>
AUDIO_PROVIDER_ENDPOINT=<real audio provider endpoint>
AUDIO_PROVIDER_API_KEY=<real audio provider key>
ADMIN_SECRET=<random 16+ character secret>
```

`PUBLIC_BASE_URL` must be the HTTPS origin of the web service. In production, the web process automatically registers Telegram's webhook as `${PUBLIC_BASE_URL}/api/telegram/webhook` using `TELEGRAM_WEBHOOK_SECRET`.

### Convex deployment

Deploy Convex first:

```bash
npm install
npm run convex:codegen
npm run convex:deploy
```

Set `AGENT_GATEWAY_SECRET` in the Convex deployment and in both application services. The `/agent/jobs/*` routes reject requests without the matching secret.

## Production processes

Run the web process and worker separately:

```bash
npm install
npm run build
npm start
npm run start:worker
```

The web process must never perform long-running video generation inside the Telegram webhook. The worker claims queued jobs and performs provider polling asynchronously.

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

## Telegram webhook

Expose the web server through HTTPS. In production, set `PUBLIC_BASE_URL`; webhook registration is then automatic at startup.

Webhook endpoint:

`/api/telegram/webhook`

Use the same random `TELEGRAM_WEBHOOK_SECRET` in the application environment and Telegram webhook configuration. Never place the bot token in source control.

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

## Deployment checklist

- [ ] Rotate any previously exposed Telegram token.
- [ ] Deploy Convex and copy its deployment URL.
- [ ] Generate `AGENT_GATEWAY_SECRET` and `TELEGRAM_WEBHOOK_SECRET`.
- [ ] Configure Gemini API key and models.
- [ ] Configure private S3-compatible storage.
- [ ] Configure real image/video/audio provider endpoints and keys.
- [ ] Deploy web service and worker service.
- [ ] Set `PUBLIC_BASE_URL` to the web service HTTPS origin.
- [ ] Verify `/health` reports the expected configured components.
- [ ] Send `/start` in Telegram.
- [ ] Test normal Gemini chat.
- [ ] Upload an image and request image-to-video.
- [ ] Verify a Convex job is queued, claimed, processed and completed.
- [ ] Verify the generated asset is delivered to Telegram.
- [ ] Test provider failure and confirm credits are refunded.
