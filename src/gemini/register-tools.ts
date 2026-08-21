import { GeminiToolDispatcher } from './tool-dispatcher.js';
import type { MediaProvider } from '../providers/types.js';

const requiredString = (args: Record<string, unknown>, key: string) => { const value = args[key]; if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`); return value.trim(); };
const optionalAssetIds = (args: Record<string, unknown>) => { if (args.asset_ids === undefined) return []; if (!Array.isArray(args.asset_ids) || !args.asset_ids.every(id => typeof id === 'string')) throw new Error('asset_ids must be an array of strings'); return args.asset_ids as string[]; };
const requiredAssetIds = (args: Record<string, unknown>) => { const ids = optionalAssetIds(args); if (!ids.length) throw new Error('asset_ids must contain at least one asset'); return ids; };

export interface JobGateway { create(input: { userId: string; intent: string; prompt: string; creditsReserved: number; reference: string; telegramChatId?: string; telegramStatusMessageId?: number; conversationId?: string; sourceAssetIds?: string[] }): Promise<{ jobId: string }>; updateStatus?(input: { jobId: string; status: 'queued' | 'analyzing' | 'processing' | 'generating' | 'rendering' | 'uploading' | 'completed' | 'failed' | 'cancelled'; progress?: number; provider?: string; providerJobId?: string; outputUrl?: string; outputAssets?: unknown; error?: string }): Promise<void>; failAndRefund(jobId: string, reason: string): Promise<void>; }

export function registerMediaTools(dispatcher: GeminiToolDispatcher, deps: { videoProvider: MediaProvider; jobs: JobGateway; videoCredits?: number }) {
  dispatcher.register('generate_video', async (args, context) => {
    const prompt = requiredString(args, 'prompt');
    const requestedIds = optionalAssetIds(args);
    const available = context.assets ?? [];
    const selected = requestedIds.length ? available.filter(asset => requestedIds.includes(asset.id)) : available.filter(asset => asset.type === 'image');
    if (requestedIds.length && selected.length !== requestedIds.length) throw new Error('One or more requested media assets are not available in the current conversation');
    if (!selected.some(asset => asset.type === 'image')) return { status: 'provider_required', operation: 'text_to_video', prompt };
    const credits = deps.videoCredits ?? 30;
    const reference = `gemini:${context.userId}:${context.requestId ?? 'request'}:generate_video`;
    const created = await deps.jobs.create({ userId: context.userId, intent: 'image_to_video', prompt, creditsReserved: credits, reference, telegramChatId: context.chatId, telegramStatusMessageId: context.statusMessageId, conversationId: context.conversationId, sourceAssetIds: selected.map(asset => asset.id) });
    return { status: 'queued', jobId: created.jobId, operation: 'image_to_video', provider: deps.videoProvider.name, progress: 0, message: 'Video generation has been queued. The background worker will generate and deliver it to Telegram.' };
  });

  dispatcher.register('edit_video', async (args) => ({ status: 'planned', operation: 'video_edit', instructions: requiredString(args, 'instructions'), assetIds: requiredAssetIds(args) }));
  dispatcher.register('generate_image', async (args) => ({ status: 'provider_required', operation: 'image_generation', prompt: requiredString(args, 'prompt'), aspectRatio: args.aspect_ratio ?? '1:1' }));
  dispatcher.register('edit_image', async (args) => ({ status: 'provider_required', operation: 'image_edit', prompt: requiredString(args, 'prompt'), assetIds: requiredAssetIds(args) }));
  dispatcher.register('transcribe_audio', async (args) => ({ status: 'provider_required', operation: 'transcribe_audio', assetId: requiredString(args, 'asset_id'), language: typeof args.language === 'string' ? args.language : null }));
  dispatcher.register('analyze_document', async (args) => ({ status: 'provider_required', operation: 'analyze_document', assetId: requiredString(args, 'asset_id'), question: typeof args.question === 'string' ? args.question : null }));
  dispatcher.register('convert_media', async (args) => ({ status: 'worker_required', operation: 'convert_media', assetId: requiredString(args, 'asset_id'), targetFormat: requiredString(args, 'target_format'), quality: typeof args.quality === 'string' ? args.quality : null }));
}
