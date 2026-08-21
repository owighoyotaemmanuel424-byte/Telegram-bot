import type { MediaAsset } from '../gemini/types.js';
import type { MediaProvider, ProviderCapabilities, ProviderJob } from './types.js';
import { providerRequest } from './http.js';

interface ProviderResponse { id?: string; status?: ProviderJob['status']; progress?: number; output_url?: string; error?: string; }

export class VideoProviderAdapter implements MediaProvider {
  readonly name = process.env.VIDEO_PROVIDER_NAME ?? 'configured-video-provider';
  readonly capabilities: ProviderCapabilities = { imageGeneration: false, imageEditing: false, imageToVideo: true, textToVideo: true, videoEditing: false, audioGeneration: false, transcription: false, upscaling: false };
  private get baseUrl() { return process.env.VIDEO_PROVIDER_BASE_URL; }

  async create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }): Promise<ProviderJob> {
    const apiKey = process.env.VIDEO_PROVIDER_API_KEY;
    if (!apiKey || !this.baseUrl) throw new Error('VIDEO_PROVIDER_API_KEY and VIDEO_PROVIDER_BASE_URL are required');
    const response = await providerRequest<ProviderResponse>(`${this.baseUrl.replace(/\/$/, '')}/generations`, apiKey, { method: 'POST', body: JSON.stringify({ operation: input.operation, prompt: input.prompt, assets: input.assets, options: input.options ?? {} }) });
    if (!response.id) throw new Error('Video provider returned no job id');
    return { providerJobId: response.id, status: response.status ?? 'queued', progress: response.progress ?? 0, error: response.error };
  }

  async getStatus(providerJobId: string): Promise<ProviderJob> {
    const apiKey = process.env.VIDEO_PROVIDER_API_KEY;
    if (!apiKey || !this.baseUrl) throw new Error('VIDEO_PROVIDER_API_KEY and VIDEO_PROVIDER_BASE_URL are required');
    const response = await providerRequest<ProviderResponse>(`${this.baseUrl.replace(/\/$/, '')}/generations/${encodeURIComponent(providerJobId)}`, apiKey);
    const outputAssets: MediaAsset[] | undefined = response.output_url ? [{ id: `provider:${providerJobId}`, type: 'video', mimeType: 'video/mp4', uri: response.output_url }] : undefined;
    return { providerJobId, status: response.status ?? 'processing', progress: response.progress, outputAssets, error: response.error };
  }
}
