# Production deployment

## Services

Run two processes from the same image:

- Web/API: `npm start`
- Worker: `npm run start:worker`

The web process receives Telegram webhooks. The worker claims queued Convex jobs, calls the configured media provider, polls asynchronously, updates progress, and delivers output back to Telegram.

## Required environment

Set the values in `.env.example`. Never commit secrets.

Minimum web configuration:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (16+ random characters)
- `GEMINI_API_KEY`
- `CONVEX_URL`
- `AGENT_GATEWAY_SECRET` (32+ random characters)
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`

For video generation also configure:

- `VIDEO_PROVIDER_ENDPOINT`
- `VIDEO_PROVIDER_API_KEY`

For image generation configure `IMAGE_PROVIDER_ENDPOINT` and `IMAGE_PROVIDER_API_KEY`.
For voice generation configure `AUDIO_PROVIDER_ENDPOINT` and `AUDIO_PROVIDER_API_KEY`.

Provider endpoints use a common contract: `POST /` accepts `{ operation, prompt, assets, options }` and returns `{ id|providerJobId, status, progress?, outputAssets? }`; `GET /:providerJobId` returns the same job shape.

## Convex

Deploy the Convex schema/functions before starting the web or worker processes:

`npm run convex:deploy`

Set `AGENT_GATEWAY_SECRET` in the Convex deployment environment as well as the worker/web environment. The HTTP agent routes reject requests without the matching `x-agent-secret` header.

## Telegram webhook

Point Telegram at:

`https://YOUR_PUBLIC_HOST/api/telegram/webhook`

and configure the same `TELEGRAM_WEBHOOK_SECRET` as Telegram's secret token. The HTTP service immediately acknowledges valid updates and processes them asynchronously.

## Health

`GET /health` reports whether Gemini, Telegram, Convex, storage, and configured media providers are available.

## Security

- Rotate any bot/API credentials that have ever been exposed in chat, logs, screenshots, or commits.
- Keep `ADMIN_SECRET` and `AGENT_GATEWAY_SECRET` private.
- Use HTTPS.
- Use an S3-compatible private bucket and short-lived signed URLs.
- Do not expose `/agent/*` routes publicly without the gateway secret.
- Run the worker as a separate service/process so long-running media jobs never block Telegram webhooks.

## Verification

Run:

`npm install`

`npm run typecheck`

`npm run build`

`npm run convex:codegen`

`npm run convex:deploy`

Then start both processes and test `/health`, `/start`, a normal Gemini message, and an image-to-video request with a configured provider.
