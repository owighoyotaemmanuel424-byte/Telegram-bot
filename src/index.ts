import http from 'node:http';
import { config } from './config.js';
import { GeminiClient } from './gemini/client.js';
import { GeminiToolDispatcher } from './gemini/tool-dispatcher.js';
import { registerMediaTools } from './gemini/register-tools.js';
import { TelegramGeminiAgent } from './gemini/telegram-agent.js';
import { TelegramApi } from './telegram/api.js';
import { TelegramHandlers } from './telegram/handlers.js';
import { ConfiguredVideoProvider } from './providers/configured-video.js';
import { HttpConvexJobGateway } from './convex/gateway.js';
import { S3MediaStorage } from './storage/s3.js';
import { adminConfigResponse, updateAdminConfig } from './admin/api.js';
import { adminProviderSettingsPage } from './admin/dashboard.js';
import type { TelegramUpdate } from './telegram/types.js';

const geminiClient = config.GEMINI_API_KEY ? new GeminiClient() : null;
const telegramApi = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : null;
const dispatcher = new GeminiToolDispatcher();
const videoProvider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
const jobs = config.CONVEX_URL && config.AGENT_GATEWAY_SECRET ? new HttpConvexJobGateway(config.CONVEX_URL, config.AGENT_GATEWAY_SECRET) : null;
if (!jobs) console.warn('Convex JobGateway is not configured; paid media tools will fail safely until CONVEX_URL and AGENT_GATEWAY_SECRET are set.');
registerMediaTools(dispatcher, { videoProvider, jobs: jobs ?? { async create() { throw new Error('Convex JobGateway is not configured'); }, async failAndRefund() {} } });
const multimodalStorage = config.STORAGE_BUCKET && config.STORAGE_ACCESS_KEY && config.STORAGE_SECRET_KEY ? new S3MediaStorage() : undefined;
const agent = geminiClient ? new TelegramGeminiAgent(geminiClient, dispatcher, multimodalStorage) : null;
const handlers = agent && telegramApi ? new TelegramHandlers(telegramApi, agent) : null;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, geminiConfigured: Boolean(geminiClient), telegramConfigured: Boolean(telegramApi), convexConfigured: Boolean(jobs), storageConfigured: Boolean(multimodalStorage), videoProviderConfigured: videoProvider.capabilities.imageToVideo })); return; }
  if (req.method === 'GET' && req.url === '/admin/providers') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(adminProviderSettingsPage()); return; }
  if (req.method === 'GET' && req.url === '/admin/api/providers') { adminConfigResponse().then(r => r.text()).then(body => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); }); return; }
  if (req.method === 'PUT' && req.url === '/admin/api/providers') {
    let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; });
    req.on('end', async () => { const request = new Request('http://localhost/admin/api/providers', { method: 'PUT', headers: { 'content-type': req.headers['content-type'] ?? '', 'x-admin-secret': req.headers['x-admin-secret'] ?? '' }, body }); const result = await updateAdminConfig(request); const text = await result.text(); res.writeHead(result.status, { 'content-type': 'application/json' }); res.end(text); }); return;
  }
  if (req.method === 'POST' && req.url === '/api/telegram/webhook') {
    let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; });
    req.on('end', async () => { try { if (!handlers) throw new Error('Telegram or Gemini is not configured'); await handlers.handle(JSON.parse(body) as TelegramUpdate); res.writeHead(200); res.end('ok'); } catch (error) { console.error('Webhook error', error); res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Webhook processing failed' })); } }); return; }
  res.writeHead(404); res.end('Not found');
});
server.listen(config.PORT, () => console.log(`Gemini Telegram assistant listening on :${config.PORT}`));
