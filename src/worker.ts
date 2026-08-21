import 'dotenv/config';
import { config } from './config.js';
import { ConfiguredVideoProvider } from './providers/configured-video.js';
import { S3MediaStorage } from './storage/s3.js';
import { TelegramApi } from './telegram/api.js';
import type { MediaAsset } from './gemini/types.js';

type WorkerJob = { _id: string; userId: string; telegramChatId?: string; status: string; prompt: string; intent: string; progress: number; sourceAssetIds?: string[] };
type WorkerAsset = { _id: string; storageKey?: string; type: MediaAsset['type']; mimeType: string; telegramFileId?: string };

class WorkerGateway {
  constructor(private readonly baseUrl: string, private readonly secret: string) {}
  private async post<T>(path: string, body: unknown): Promise<T> { const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-secret': this.secret }, body: JSON.stringify(body) }); const text = await response.text(); if (!response.ok) throw new Error(`Worker gateway ${response.status}: ${text}`); return JSON.parse(text) as T; }
  claim() { return this.post<{ job: WorkerJob | null; assets: WorkerAsset[] }>('/agent/jobs/claim', {}); }
  status(input: { jobId: string; status: 'processing' | 'generating' | 'rendering' | 'uploading' | 'completed'; progress?: number; provider?: string; providerJobId?: string; outputUrl?: string; outputAssets?: unknown }) { return this.post('/agent/jobs/status', input); }
  fail(jobId: string, reason: string) { return this.post('/agent/jobs/fail', { jobId, reason }); }
}

const gateway = new WorkerGateway(config.CONVEX_URL!, config.AGENT_GATEWAY_SECRET!);
const provider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
const storage = new S3MediaStorage();
const telegram = new TelegramApi();

async function processJob(job: WorkerJob, sourceAssets: WorkerAsset[]) {
  if (job.intent !== 'image_to_video' && job.intent !== 'text_to_video') { await gateway.fail(job._id, `Unsupported worker intent: ${job.intent}`); return; }
  await gateway.status({ jobId: job._id, status: 'processing', progress: 5, provider: provider.name });
  const assets: MediaAsset[] = [];
  for (const asset of sourceAssets) {
    if (!asset.storageKey) continue;
    const uri = await storage.signedGetUrl(asset.storageKey, 900);
    assets.push({ id: String(asset._id), type: asset.type, mimeType: asset.mimeType, telegramFileId: asset.telegramFileId, storageKey: asset.storageKey, uri });
  }
  await gateway.status({ jobId: job._id, status: 'generating', progress: 10, provider: provider.name });
  const created = await provider.create({ operation: job.intent, prompt: job.prompt, assets, options: { jobId: job._id } });
  await gateway.status({ jobId: job._id, status: 'generating', progress: created.progress ?? 10, provider: provider.name, providerJobId: created.providerJobId });
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const current = await provider.getStatus(created.providerJobId);
    if (current.status === 'failed') throw new Error(current.error ?? 'Media provider failed');
    if (current.status === 'completed') {
      const outputAssets = current.outputAssets ?? [];
      const outputUrl = outputAssets.find(asset => asset.uri)?.uri;
      await gateway.status({ jobId: job._id, status: 'completed', progress: 100, provider: provider.name, providerJobId: created.providerJobId, outputUrl, outputAssets });
      if (job.telegramChatId) {
        for (const output of outputAssets) {
          if (output.type === 'video' && output.uri) await telegram.sendVideo(job.telegramChatId, output.uri, '🎬 Your video is ready.');
          else if (output.type === 'image' && output.uri) await telegram.sendPhoto(job.telegramChatId, output.uri, '🖼 Your image is ready.');
          else if (output.type === 'audio' && output.uri) await telegram.sendAudio(job.telegramChatId, output.uri, '🎙 Your audio is ready.');
          else if (output.uri) await telegram.sendDocument(job.telegramChatId, output.uri, '📄 Your file is ready.');
        }
      }
      return;
    }
    await gateway.status({ jobId: job._id, status: 'generating', progress: Math.max(10, Math.min(95, current.progress ?? 10)), provider: provider.name, providerJobId: created.providerJobId });
  }
  throw new Error('Media provider job timed out after 10 minutes');
}

async function loop() {
  if (!config.CONVEX_URL || !config.AGENT_GATEWAY_SECRET || !config.TELEGRAM_BOT_TOKEN || !config.STORAGE_BUCKET || !config.STORAGE_ACCESS_KEY || !config.STORAGE_SECRET_KEY || !config.VIDEO_PROVIDER_API_KEY || !config.VIDEO_PROVIDER_ENDPOINT) throw new Error('Worker requires Convex, Telegram, S3, and video-provider configuration');
  for (;;) {
    try {
      const claimed = await gateway.claim();
      if (!claimed.job) { await new Promise(resolve => setTimeout(resolve, 2000)); continue; }
      try { await processJob(claimed.job, claimed.assets); } catch (error) { await gateway.fail(claimed.job._id, error instanceof Error ? error.message : 'Worker failed'); if (claimed.job.telegramChatId) await telegram.sendMessage(claimed.job.telegramChatId, `❌ Media job failed: ${error instanceof Error ? error.message : 'Unknown worker error'}`); }
    } catch (error) { console.error('Worker loop error:', error); await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
}

loop().catch(error => { console.error(error); process.exit(1); });
