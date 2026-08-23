import http from 'node:http';
import { config } from './config.js';
import { getAIProvider } from './ai/factory.js';
import type { GeminiClient } from './gemini/client.js';
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
import { AppBuilderService } from './app-builder/service.js';
import { VercelDeployer } from './app-builder/deployer.js';
import type { TelegramUpdate } from './telegram/types.js';

let aiProvider: ReturnType<typeof getAIProvider> | null = null;
try { aiProvider = getAIProvider(); console.log('AI provider initialized.'); } catch (error) { console.warn(error instanceof Error ? error.message : error); }
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
const agent = aiProvider ? new TelegramGeminiAgent(aiProvider, dispatcher, multimodalStorage) : null;
const vercelDeployer = config.VERCEL_TOKEN ? new VercelDeployer(config.VERCEL_TOKEN, config.VERCEL_TEAM_ID) : undefined;
const appBuilder = aiProvider && config.GITHUB_TOKEN && config.GITHUB_OWNER && config.GITHUB_REPOSITORY ? new AppBuilderService(aiProvider as GeminiClient, vercelDeployer) : undefined;
const handlers = agent && telegramApi ? new TelegramHandlers(telegramApi, agent, appBuilder) : null;
const rate = new Map<string, { count: number; resetAt: number }>();
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
function limited(key: string) { const now = Date.now(); const current = rate.get(key); if (!current || current.resetAt <= now) { rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; } current.count += 1; return current.count > RATE_LIMIT; }
function headerValue(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, aiProviderConfigured: Boolean(aiProvider), telegramConfigured: Boolean(telegramApi), convexConfigured: Boolean(jobs), storageConfigured: Boolean(multimodalStorage), appBuilderConfigured: Boolean(appBuilder), githubConfigured: Boolean(config.GITHUB_TOKEN && config.GITHUB_OWNER && config.GITHUB_REPOSITORY), vercelConfigured: Boolean(vercelDeployer), webhookConfigured: Boolean(config.PUBLIC_BASE_URL && config.TELEGRAM_WEBHOOK_SECRET), videoProviderConfigured: videoProvider.capabilities.imageToVideo, imageProviderConfigured: imageProvider.capabilities.imageGeneration, audioProviderConfigured: audioProvider.capabilities.audioGeneration })); return; }
  if (req.method === 'GET' && req.url === '/admin/providers') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(adminProviderSettingsPage()); return; }
  if (req.method === 'GET' && req.url === '/admin/api/providers') { try { const result = adminConfigResponse(); res.writeHead(result.status, { 'content-type': 'application/json' }); void result.text().then(text => res.end(text)); } catch { res.writeHead(500); res.end('Internal error'); } return; }
  if (req.method === 'PUT' && req.url === '/admin/api/providers') { let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY_BYTES) req.destroy(); }); req.on('end', async () => { try { const request = new Request('http://localhost/admin/api/providers', { method: 'PUT', headers: { 'content-type': headerValue(req.headers['content-type']), 'x-admin-secret': headerValue(req.headers['x-admin-secret']) }, body }); const result = await updateAdminConfig(request); const text = await result.text(); res.writeHead(result.status, { 'content-type': 'application/json' }); res.end(text); } catch { res.writeHead(400); res.end('Bad request'); } }); return; }
  if (req.method === 'POST' && req.url === '/api/telegram/webhook') { const suppliedSecret = headerValue(req.headers['x-telegram-bot-api-secret-token']); const clientKey = headerValue(req.headers['x-forwarded-for']) || req.socket.remoteAddress || 'unknown'; if (!config.TELEGRAM_WEBHOOK_SECRET || suppliedSecret !== config.TELEGRAM_WEBHOOK_SECRET) { res.writeHead(401); res.end('Unauthorized'); return; } if (limited(clientKey)) { res.writeHead(429); res.end('Too many requests'); return; } let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > MAX_BODY_BYTES) { res.writeHead(413); res.end('Payload too large'); req.destroy(); } }); req.on('end', () => { try { if (!handlers) throw new Error('Telegram or AI provider is not configured'); const update = JSON.parse(body) as TelegramUpdate; void handlers.handle(update).catch(error => console.error('Telegram background handler error', error)); res.writeHead(200); res.end('ok'); } catch (error) { console.error('Webhook error', error); res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Webhook processing failed' })); } }); return; }
  res.writeHead(404); res.end('Not found');
});
async function startTelegramReceiver() {
  if (!telegramApi || !handlers) { console.warn('Telegram receiver disabled: TELEGRAM_BOT_TOKEN and an AI provider are required.'); return; }
  if (config.PUBLIC_BASE_URL && config.TELEGRAM_WEBHOOK_SECRET) { const webhookUrl = `${config.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/telegram/webhook`; try { await telegramApi.setWebhook(webhookUrl, config.TELEGRAM_WEBHOOK_SECRET); console.log(`Telegram webhook registered: ${webhookUrl}`); return; } catch (error) { console.error('Telegram webhook registration failed; falling back to polling:', error); } }
  try { await telegramApi.deleteWebhook(); } catch (error) { console.error('Could not clear Telegram webhook before polling:', error); }
  let offset = 0;
  console.log('Telegram long polling receiver started.');
  const poll = async () => { try { const updates = await telegramApi.getUpdates(offset, 25); for (const update of updates) { offset = Math.max(offset, Number(update.update_id) + 1); void handlers.handle(update).catch(error => console.error('Telegram polling handler error', error)); } } catch (error) { console.error('Telegram polling error:', error); await new Promise(resolve => setTimeout(resolve, 5000)); } setImmediate(poll); };
  void poll();
}
server.listen(config.PORT, () => { console.log(`Gemini Telegram assistant listening on :${config.PORT}`); void startTelegramReceiver(); });
