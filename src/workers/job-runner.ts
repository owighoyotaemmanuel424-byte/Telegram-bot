import { config } from '../config.js';
import { ConfiguredVideoProvider } from '../providers/configured-video.js';
import { TelegramApi } from '../telegram/api.js';
import type { MediaAsset } from '../gemini/types.js';

interface GatewayJob { _id: string; prompt: string; intent: string; telegramChatId?: string; telegramStatusMessageId?: number; }
interface ClaimedResponse { job: GatewayJob | null; assets?: MediaAsset[]; }

export class MediaJobRunner {
  private readonly provider = new ConfiguredVideoProvider(config.VIDEO_PROVIDER_ENDPOINT);
  private readonly telegram = config.TELEGRAM_BOT_TOKEN ? new TelegramApi() : undefined;
  private readonly gatewayUrl = config.CONVEX_URL;
  private readonly secret = process.env.AGENT_GATEWAY_SECRET;
  private readonly intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 2000);
  private readonly maxPolls = Number(process.env.WORKER_MAX_POLLS ?? 180);

  constructor() { if (!this.gatewayUrl || !this.secret) throw new Error('CONVEX_URL and AGENT_GATEWAY_SECRET are required for the worker'); }
  private async gateway<T>(path: string, body: unknown): Promise<T> { const response = await fetch(`${this.gatewayUrl!.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-secret': this.secret! }, body: JSON.stringify(body) }); const text = await response.text(); if (!response.ok) throw new Error(`Worker gateway ${response.status}: ${text}`); return JSON.parse(text) as T; }
  private update(jobId: string, patch: Record<string, unknown>) { return this.gateway('/agent/jobs/status', { jobId, ...patch }); }
  private fail(jobId: string, reason: string) { return this.gateway('/agent/jobs/fail', { jobId, reason }); }

  private async deliver(job: GatewayJob, outputs: unknown) {
    if (!this.telegram || !job.telegramChatId) return;
    if (job.telegramStatusMessageId) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, '✅ Your video is ready.');
    for (const item of Array.isArray(outputs) ? outputs : []) {
      if (!item || typeof item !== 'object') continue;
      const output = item as Record<string, unknown>;
      const target = typeof output.telegramFileId === 'string' ? output.telegramFileId : typeof output.uri === 'string' ? output.uri : undefined;
      if (!target) continue;
      if (output.type === 'video') await this.telegram.sendVideo(job.telegramChatId, target, '🎬 Generated video');
      else if (output.type === 'image') await this.telegram.sendPhoto(job.telegramChatId, target, '🖼 Generated image');
      else if (output.type === 'audio') await this.telegram.sendAudio(job.telegramChatId, target, '🎙 Generated audio');
      else await this.telegram.sendDocument(job.telegramChatId, target, '📄 Generated file');
    }
  }

  private async process(job: GatewayJob, assets: MediaAsset[]) {
    if (job.intent !== 'image_to_video' && job.intent !== 'text_to_video') { await this.fail(job._id, `Unsupported worker intent: ${job.intent}`); return; }
    try {
      await this.update(job._id, { status: 'generating', progress: 5, provider: this.provider.name });
      const created = await this.provider.create({ operation: job.intent, prompt: job.prompt, assets, options: {} });
      await this.update(job._id, { status: created.status === 'completed' ? 'completed' : 'generating', progress: created.progress ?? 10, provider: this.provider.name, providerJobId: created.providerJobId, outputAssets: created.outputAssets });
      if (created.status === 'completed') { await this.deliver(job, created.outputAssets); return; }
      for (let attempt = 1; attempt <= this.maxPolls; attempt++) {
        await new Promise(resolve => setTimeout(resolve, this.intervalMs));
        const current = await this.provider.getStatus(created.providerJobId);
        if (current.status === 'failed') throw new Error(current.error ?? 'Video provider failed');
        const progress = Math.min(99, Math.max(1, current.progress ?? Math.round((attempt / this.maxPolls) * 90) + 5));
        await this.update(job._id, { status: current.status === 'completed' ? 'uploading' : 'generating', progress, provider: this.provider.name, providerJobId: current.providerJobId, outputAssets: current.outputAssets });
        if (job.telegramChatId && job.telegramStatusMessageId && this.telegram) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, `🎬 Creating your video...\n\n${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))} ${progress}%`);
        if (current.status === 'completed') { await this.update(job._id, { status: 'completed', progress: 100, provider: this.provider.name, providerJobId: current.providerJobId, outputAssets: current.outputAssets }); await this.deliver(job, current.outputAssets); return; }
      }
      throw new Error('Video provider job timed out');
    } catch (error) { const reason = error instanceof Error ? error.message : 'Background media job failed'; await this.fail(job._id, reason); if (job.telegramChatId && job.telegramStatusMessageId && this.telegram) await this.telegram.editMessage(job.telegramChatId, job.telegramStatusMessageId, `❌ Media generation failed: ${reason}`); }
  }

  async start() { console.log('Background media worker started'); for (;;) { try { const response = await this.gateway<ClaimedResponse>('/agent/jobs/claim', {}); if (response.job) await this.process(response.job, response.assets ?? []); else await new Promise(resolve => setTimeout(resolve, this.intervalMs)); } catch (error) { console.error('Worker loop error', error); await new Promise(resolve => setTimeout(resolve, this.intervalMs * 2)); } } }
}

if (process.env.WORKER_ENABLED === 'true') void new MediaJobRunner().start();
