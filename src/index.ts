import http from 'node:http';
import { config } from './config.js';
import { GeminiService } from './gemini/service.js';
import { TelegramApi } from './telegram/api.js';
import { TelegramHandlers } from './telegram/handlers.js';
import type { TelegramUpdate } from './telegram/types.js';

const gemini = config.GEMINI_API_KEY ? new GeminiService() : null;
const telegramApi = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : null;
const handlers = gemini && telegramApi ? new TelegramHandlers(telegramApi, gemini) : null;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, geminiConfigured: Boolean(gemini), telegramConfigured: Boolean(telegramApi) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/telegram/webhook') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!handlers) throw new Error('Telegram or Gemini is not configured');
        const update = JSON.parse(body) as TelegramUpdate;
        await handlers.handle(update);
        res.writeHead(200);
        res.end('ok');
      } catch (error) {
        console.error('Webhook error', error);
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Webhook processing failed' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(config.PORT, () => {
  console.log(`Gemini Telegram assistant listening on :${config.PORT}`);
});
