# Gemini Telegram AI Media Assistant

Production-oriented foundation for a Gemini-powered Telegram AI media assistant.

## Architecture

- Telegram webhook/bot layer
- Gemini orchestration service
- Structured intent/tool planning
- Provider abstraction for image/video/audio/media
- Background job model
- Persistent user/conversation/media/job data model
- Credits and payment-ready accounting boundaries
- Admin control-plane foundation

## Environment

Copy `.env.example` to `.env` and provide real credentials. Never commit secrets.

## Status

Foundation initialized. Media providers are intentionally adapter-based so real provider credentials can be configured without coupling the bot to one vendor.
