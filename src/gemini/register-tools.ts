import { GeminiToolDispatcher } from './tool-dispatcher.js';
import type { MediaProvider } from '../providers/types.js';
import { ImageToVideoWorker } from '../workers/image-to-video.js';

const requiredString = (args: Record<string, unknown>, key: string) => {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
};
const assetIds = (args: Record<string, unknown>) => {
  if (!Array.isArray(args.asset_ids) || !args.asset_ids.every(id => typeof id === 'string')) throw new Error('asset_ids must be an array of strings');
  return args.asset_ids as string[];
};

export interface JobGateway {
  create(input: { userId: string; intent: string; prompt: string; creditsReserved: number; reference: string }): Promise<{ jobId: string }>;
  failAndRefund(jobId: string, reason: string): Promise<void>;
}

export function registerMediaTools(dispatcher: GeminiToolDispatcher, deps: { videoProvider: MediaProvider; jobs: JobGateway; videoCredits?: number }) {
  dispatcher.register('generate_video', async (args, context) => {
    const prompt = requiredString(args, 'prompt');
    const ids = args.asset_ids === undefined ? [] : assetIds(args);
    if (!ids.length) return { status: 'provider_required', operation: 'text_to_video', prompt };
    const credits = deps.videoCredits ?? 30;
    const reference = `gemini:${context.userId}:${context.jobId ?? 'request'}:generate_video`;
    const created = await deps.jobs.create({ userId: context.userId, intent: 'image_to_video', prompt, creditsReserved: credits, reference });
    try {
      const result = await new ImageToVideoWorker(deps.videoProvider).run({ prompt, assets: ids.map(id => ({ id, type: 'image', mimeType: 'image/*' })), options: { duration: args.duration, aspectRatio: args.aspect_ratio, jobId: created.jobId } });
      return { status: result.job.status, jobId: created.jobId, providerJobId: result.job.providerJobId, progress: result.job.progress ?? 100, outputAssets: result.job.outputAssets ?? [] };
    } catch (error) {
      await deps.jobs.failAndRefund(created.jobId, error instanceof Error ? error.message : 'Video generation failed');
      throw error;
    }
  });

  dispatcher.register('edit_video', async (args) => ({ status: 'planned', operation: 'video_edit', instructions: requiredString(args, 'instructions'), assetIds: assetIds(args) }));
  dispatcher.register('generate_image', async (args) => ({ status: 'provider_required', operation: 'image_generation', prompt: requiredString(args, 'prompt'), aspectRatio: args.aspect_ratio ?? '1:1' }));
  dispatcher.register('edit_image', async (args) => ({ status: 'provider_required', operation: 'image_edit', prompt: requiredString(args, 'prompt'), assetIds: assetIds(args) }));
  dispatcher.register('transcribe_audio', async (args) => ({ status: 'provider_required', operation: 'transcribe_audio', assetId: requiredString(args, 'asset_id'), language: typeof args.language === 'string' ? args.language : null }));
  dispatcher.register('analyze_document', async (args) => ({ status: 'provider_required', operation: 'analyze_document', assetId: requiredString(args, 'asset_id'), question: typeof args.question === 'string' ? args.question : null }));
  dispatcher.register('convert_media', async (args) => ({ status: 'worker_required', operation: 'convert_media', assetId: requiredString(args, 'asset_id'), targetFormat: requiredString(args, 'target_format'), quality: typeof args.quality === 'string' ? args.quality : null }));
}
