import http from 'node:http';
import { config } from './config.js';
import { GeminiService } from './gemini/service.js';
import { TelegramBotService } from './telegram/bot.js';

const gemini = config.GEMINI_API_KEY ? new GeminiService() : null;
const telegram = gemini ? new TelegramBotService(gemini) : null;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, geminiConfigured: Boolean(gemini) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/telegram/webhook') {
    if (!telegram) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Gemini is not configured' }));
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const update = JSON.parse(body) as { message?: { chat?: { id?: number }; text?: string } };
        const message = update.message;
        if (!message?.chat?.id) {
          res.writeHead(200);
          res.end('ok');
          return;
        }
        await telegram.handleMessage({ chatId: String(message.chat.id), text: message.text });
        res.writeHead(200);
        res.end('ok');
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid webhook payload' }));
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
