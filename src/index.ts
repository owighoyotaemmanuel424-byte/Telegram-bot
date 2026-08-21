import http from 'node:http';
import { config } from './config.js';
import { GeminiClient } from './gemini/client.js';
import { GeminiToolDispatcher } from './gemini/tool-dispatcher.js';
import { registerMediaTools } from './gemini/register-tools.js';
import { TelegramGeminiAgent } from './gemini/telegram-agent.js';
import { TelegramApi } from './telegram/api.js';
import { TelegramHandlers } from './telegram/handlers.js';
import { ConfiguredVideoProvider } from './providers/configured-video.js';
import type { TelegramUpdate } from './telegram/types.js';

const geminiClient = config.GEMINI_API_KEY ? new GeminiClient() : null;
const telegramApi = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : null;
const dispatcher = new GeminiToolDispatcher();
const videoProvider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
const jobs = {
  async create() { throw new Error('Convex JobGateway is not configured in this process'); },
  async failAndRefund() { return undefined; }
};
registerMediaTools(dispatcher, { videoProvider, jobs });
const agent = geminiClient ? new TelegramGeminiAgent(geminiClient, dispatcher) : null;
const handlers = agent && telegramApi ? new TelegramHandlers(telegramApi, agent) : null;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, geminiConfigured: Boolean(geminiClient), telegramConfigured: Boolean(telegramApi), videoProviderConfigured: videoProvider.capabilities.imageToVideo }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/telegram/webhook') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!handlers) throw new Error('Telegram or Gemini is not configured');
        await handlers.handle(JSON.parse(body) as TelegramUpdate);
        res.writeHead(200); res.end('ok');
      } catch (error) {
        console.error('Webhook error', error);
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Webhook processing failed' }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(config.PORT, () => console.log(`Gemini Telegram assistant listening on :${config.PORT}`));
