import { GeminiToolDispatcher } from './tool-dispatcher.js';
import type { MediaProvider } from '../providers/types.js';
import { ImageToVideoWorker } from '../workers/image-to-video.js';

export function registerMediaTools(dispatcher: GeminiToolDispatcher, deps: { videoProvider: MediaProvider }) {
  dispatcher.register('generate_video', async (args, context) => {
    const prompt = typeof args.prompt === 'string' ? args.prompt : '';
    if (!prompt) throw new Error('generate_video requires a prompt');
    const assetIds = Array.isArray(args.asset_ids) ? args.asset_ids.filter((id): id is string => typeof id === 'string') : [];
    const assets = assetIds.map(id => ({ id, type: 'image', mimeType: 'image/*' }));
    const result = await new ImageToVideoWorker(deps.videoProvider).run({ prompt, assets, options: { duration: args.duration, aspectRatio: args.aspect_ratio, userId: context.userId, jobId: context.jobId } });
    return { providerJobId: result.job.providerJobId, status: result.job.status, progress: result.job.progress ?? 100, outputAssets: result.job.outputAssets ?? [] };
  });

  dispatcher.register('edit_video', async (args) => {
    const instructions = typeof args.instructions === 'string' ? args.instructions : '';
    if (!instructions) throw new Error('edit_video requires instructions');
    return { status: 'planned', instructions, assetIds: args.asset_ids ?? [] };
  });

  dispatcher.register('generate_image', async (args) => {
    const prompt = typeof args.prompt === 'string' ? args.prompt : '';
    if (!prompt) throw new Error('generate_image requires a prompt');
    return { status: 'provider_required', prompt, aspectRatio: args.aspect_ratio ?? '1:1' };
  });

  dispatcher.register('edit_image', async (args) => {
    if (!Array.isArray(args.asset_ids) || !args.asset_ids.length) throw new Error('edit_image requires asset_ids');
    return { status: 'provider_required', prompt: args.prompt ?? '', assetIds: args.asset_ids };
  });

  dispatcher.register('transcribe_audio', async (args) => {
    if (typeof args.asset_id !== 'string') throw new Error('transcribe_audio requires asset_id');
    return { status: 'provider_required', assetId: args.asset_id, language: args.language ?? null };
  });

  dispatcher.register('analyze_document', async (args) => {
    if (typeof args.asset_id !== 'string') throw new Error('analyze_document requires asset_id');
    return { status: 'provider_required', assetId: args.asset_id, question: args.question ?? null };
  });

  dispatcher.register('convert_media', async (args) => {
    if (typeof args.asset_id !== 'string' || typeof args.target_format !== 'string') throw new Error('convert_media requires asset_id and target_format');
    return { status: 'worker_required', assetId: args.asset_id, targetFormat: args.target_format, quality: args.quality ?? null };
  });
}
