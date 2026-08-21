import http from 'node:http';
import { config } from './config.js';
import { GeminiClient } from './gemini/client.js';
import { GeminiToolDispatcher } from './gemini/tool-dispatcher.js';
import { registerMediaTools } from './gemini/register-tools.js';
import { TelegramGeminiAgent } from './gemini/telegram-agent.js';
import { TelegramApi } from './telegram/api.js';
import { TelegramHandlers } from './telegram/handlers.js';
import { ConfiguredVideoProvider } from './providers/configured-video.js';
import { ConfiguredGenericProvider } from './providers/configured-generic.js';
import { HttpConvexJobGateway } from './convex/gateway.js';
import { S3MediaStorage } from './storage/s3.js';
import { adminConfigResponse, updateAdminConfig } from './admin/api.js';
import { adminProviderSettingsPage } from './admin/dashboard.js';
import type { TelegramUpdate } from './telegram/types.js';

const geminiClient = config.GEMINI_API_KEY ? new GeminiClient() : null;
const telegramApi = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : null;
const dispatcher = new GeminiToolDispatcher();
const videoProvider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
const imageProvider = new ConfiguredGenericProvider('configured-image-provider', config.IMAGE_PROVIDER_ENDPOINT, config.IMAGE_PROVIDER_API_KEY, { imageGeneration: Boolean(config.IMAGE_PROVIDER_API_KEY), imageEditing: Boolean(config.IMAGE_PROVIDER_API_KEY), imageToVideo: false, textToVideo: false, videoEditing: false, audioGeneration: false, transcription: false, upscaling: false });
const audioProvider = new ConfiguredGenericProvider('configured-audio-provider', config.AUDIO_PROVIDER_ENDPOINT, config.AUDIO_PROVIDER_API_KEY, { imageGeneration: false, imageEditing: false, imageToVideo: false, textToVideo: false, videoEditing: false, audioGeneration: Boolean(config.AUDIO_PROVIDER_API_KEY), transcription: false, upscaling: false });
const jobs = config.CONVEX_URL && config.AGENT_GATEWAY_SECRET ? new HttpConvexJobGateway(config.CONVEX_URL, config.AGENT_GATEWAY_SECRET) : null;
if (!jobs) console.warn('Convex JobGateway is not configured; paid media tools will fail safely until Convex is configured.');
const safeJobs = jobs ?? { async create() { throw new Error('Convex JobGateway is not configured'); }, async failAndRefund() {} };
registerMediaTools(dispatcher, { videoProvider, imageProvider, audioProvider, jobs: safeJobs });
const multimodalStorage = config.STORAGE_BUCKET && config.STORAGE_ACCESS_KEY && config.STORAGE_SECRET_KEY ? new S3MediaStorage() : undefined;
const agent = geminiClient ? new TelegramGeminiAgent(geminiClient, dispatcher, multimodalStorage) : null;
const handlers = agent && telegramApi ? new TelegramHandlers(telegramApi, agent) : null;
const rate = new Map<string, { count: number; resetAt: number }>(); const MAX_BODY_BYTES = 2 * 1024 * 1024; const RATE_LIMIT = 30; const RATE_WINDOW_MS = 60_000;
function limited(key: string) { const now = Date.now(); const current = rate.get(key); if (!current || current.resetAt <= now) { rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; } current.count += 1; return current.count > RATE_LIMIT; }
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, geminiConfigured: Boolean(geminiClient), telegramConfigured: Boolean(telegramApi), convexConfigured: Boolean(jobs), storageConfigured: Boolean(multimodalStorage), videoProviderConfigured: videoProvider.capabilities.imageToVideo, imageProviderConfigured: imageProvider.capabilities.imageGeneration, audioProviderConfigured: audioProvider.capabilities.audioGeneration })); return; }
  if (req.method === 'GET' && req.url === '/admin/providers') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(adminProviderSettingsPage()); return; }
  if (req.method === 'GET' && req.url === '/admin/api/providers') { adminConfigResponse().then(r => r.text()).then(body => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); }).catch(() => { res.writeHead(500); res.end('Internal error'); }); return; }
  if (req.method === 'PUT' && req.url === '/admin/api/providers') { let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY_BYTES) req.destroy(); }); req.on('end', async () => { try { const request = new Request('http://localhost/admin/api/providers', { method: 'PUT', headers: { 'content-type': req.headers['content-type'] ?? '', 'x-admin-secret': req.headers['x-admin-secret'] ?? '' }, body }); const result = await updateAdminConfig(request); const text = await result.text(); res.writeHead(result.status, { 'content-type': 'application/json' }); res.end(text); } catch { res.writeHead(400); res.end('Bad request'); } }); return; }
  if (req.method === 'POST' && req.url === '/api/telegram/webhook') { const suppliedSecret = req.headers['x-telegram-bot-api-secret-token']; const clientKey = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown'); if (!config.TELEGRAM_WEBHOOK_SECRET || suppliedSecret !== config.TELEGRAM_WEBHOOK_SECRET) { res.writeHead(401); res.end('Unauthorized'); return; } if (limited(clientKey)) { res.writeHead(429); res.end('Too many requests'); return; } let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY_BYTES) { res.writeHead(413); res.end('Payload too large'); req.destroy(); } }); req.on('end', () => { try { if (!handlers) throw new Error('Telegram or Gemini is not configured'); void handlers.handle(JSON.parse(body) as TelegramUpdate).catch(error => console.error('Telegram background handler error', error)); res.writeHead(200); res.end('ok'); } catch (error) { console.error('Webhook error', error); res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Webhook processing failed' })); } }); return; }
  res.writeHead(404); res.end('Not found');
});
server.listen(config.PORT, () => console.log(`Gemini Telegram assistant listening on :${config.PORT}`));
