import { createServer } from 'node:http';
import { config } from '../config.js';
import { TelegramRouter } from './router.js';

export function startTelegramServer(router: TelegramRouter) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/telegram/webhook') {
      response.writeHead(404); response.end('Not found'); return;
    }
    if (config.TELEGRAM_WEBHOOK_SECRET && request.headers['x-telegram-bot-api-secret-token'] !== config.TELEGRAM_WEBHOOK_SECRET) {
      response.writeHead(401); response.end('Unauthorized'); return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const update = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await router.handle(update);
      response.writeHead(200, { 'content-type': 'text/plain' }); response.end('ok');
    } catch (error) {
      console.error('Telegram webhook error', error);
      response.writeHead(500); response.end('Internal error');
    }
  });
  server.listen(config.PORT, () => console.log(`Telegram server listening on ${config.PORT}`));
  return server;
}
