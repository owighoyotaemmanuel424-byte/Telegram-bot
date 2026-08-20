import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';

const http = httpRouter();

http.route({
  path: '/telegram/webhook',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => {
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
    return new Response('ok', { status: 200 });
  })
});

export default http;
