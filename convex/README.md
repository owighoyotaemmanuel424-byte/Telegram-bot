# Convex

This project uses Convex as its primary application database.

Required environment variables for the Convex deployment:

- `TELEGRAM_WEBHOOK_SECRET`
- `GEMINI_API_KEY`

The generated `convex/_generated` directory is produced by the Convex CLI and should not be hand-written.

Run the Convex development workflow with the official Convex CLI, then configure the deployment URL as the Telegram webhook endpoint. Keep secrets in Convex/Vercel environment configuration rather than Git.
