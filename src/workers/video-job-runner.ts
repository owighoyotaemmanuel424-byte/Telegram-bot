import { config } from '../config.js';
import { ConfiguredVideoProvider } from '../providers/configured-video.js';
import { TelegramApi } from '../telegram/api.js';
import type { MediaAsset } from '../gemini/types.js';

type ClaimedJob = { _id: string; prompt: string; intent: string; telegramChatId?: string; telegramStatusMessageId?: number; sourceAssetIds?: string[]; assets?: Array<Record<string, unknown>>; providerJobId?: string; status: string };
type ClaimResponse = { job: ClaimedJob | null; assets?: Array<Record<string, unknown>> };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class VideoJobRunner {
  private readonly provider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
  private readonly telegram = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : undefined;
  constructor(private readonly convexUrl = config.CONVEX_URL, private readonly secret = config.AGENT_GATEWAY_SECRET) {
    if (!convexUrl || !secret) throw new Error('CONVEX_URL and AGENT_GATEWAY_SECRET are required');
  }
  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.convexUrl!.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-secret': this.secret! }, body: JSON.stringify(body) });
    const text = await response.text(); if (!response.ok) throw new Error(`Convex worker API ${response.status}: ${text}`); return JSON.parse(text) as T;
  }
  async runOnce(): Promise<boolean> {
    const { job, assets = [] } = await this.post<ClaimResponse>('/agent/jobs/claim', {}); if (!job) return false;
    try {
      await this.status(job, 'generating', 10, 'Starting video generation');
      const media: MediaAsset[] = assets.map(asset => ({ id: String(asset._id), type: asset.type as MediaAsset['type'], mimeType: String(asset.mimeType), storageKey: typeof asset.storageKey === 'string' ? asset.storageKey : undefined }));
      const created = await this.provider.create({ operation: job.intent, prompt: job.prompt, assets: media, options: { jobId: job._id } });
      await this.status(job, created.status === 'queued' ? 'processing' : 'generating', created.progress ?? 10, undefined, created.providerJobId);
      let current = created;
      for (let attempt = 0; attempt < 180 && current.status !== 'completed' && current.status !== 'failed'; attempt++) {
        await sleep(5000);
        current = await this.provider.getStatus(created.providerJobId);
        const progress = Math.max(1, Math.min(99, current.progress ?? Math.round(((attempt + 1) / 180) * 90) + 10));
        await this.status(job, 'rendering', progress, undefined, current.providerJobId);
      }
      if (current.status !== 'completed') throw new Error(current.error ?? 'Video provider timed out or failed');
      const output = current.outputAssets ?? [];
      const first = output.find(asset => asset.uri)?.uri;
      await this.status(job, 'completed', 100, undefined, current.providerJobId, first, output);
      if (this.telegram && job.telegramChatId) {
        if (job.telegramStatusMessageId) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, '✅ Your video is ready.');
        for (const asset of output) if (asset.uri) await this.telegram.sendVideo(job.telegramChatId, asset.uri, '🎬 Generated video');
      }
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Video generation failed';
      await this.post('/agent/jobs/fail', { jobId: job._id, reason });
      if (this.telegram && job.telegramChatId && job.telegramStatusMessageId) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, `❌ Video generation failed: ${reason}`);
      return true;
    }
  }
  private async status(job: ClaimedJob, status: 'queued' | 'analyzing' | 'processing' | 'generating' | 'rendering' | 'uploading' | 'completed' | 'failed' | 'cancelled', progress?: number, error?: string, providerJobId?: string, outputUrl?: string, outputAssets?: unknown) { await this.post('/agent/jobs/status', { jobId: job._id, status, progress, provider: this.provider.name, providerJobId, outputUrl, outputAssets, error }); if (this.telegram && job.telegramChatId && job.telegramStatusMessageId && progress !== undefined) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, `🎬 Creating your video... ${progress}%`); }
}

if (process.argv[1]?.endsWith('video-job-runner.js')) { const runner = new VideoJobRunner(); const loop = async () => { try { await runner.runOnce(); } catch (error) { console.error(error); } setTimeout(loop, 1000); }; void loop(); }
