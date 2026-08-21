import type { MediaProvider, ProviderCapabilities, ProviderJob } from './types.js';
import type { MediaAsset } from '../gemini/types.js';

export class ConfiguredVideoProvider implements MediaProvider {
  readonly name = 'configured-video-provider';
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: false,
    imageEditing: false,
    imageToVideo: Boolean(process.env.VIDEO_PROVIDER_API_KEY),
    textToVideo: Boolean(process.env.VIDEO_PROVIDER_API_KEY),
    videoEditing: false,
    audioGeneration: false,
    transcription: false,
    upscaling: false
  };

  constructor(private readonly endpoint = process.env.VIDEO_PROVIDER_ENDPOINT) {}

  async create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }): Promise<ProviderJob> {
    if (!this.endpoint || !process.env.VIDEO_PROVIDER_API_KEY) throw new Error('VIDEO_PROVIDER_ENDPOINT and VIDEO_PROVIDER_API_KEY are required for video generation');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.VIDEO_PROVIDER_API_KEY}` },
      body: JSON.stringify(input)
    });
    const body = await response.json() as Partial<ProviderJob> & { id?: string; error?: string };
    if (!response.ok) throw new Error(body.error ?? `Video provider error: ${response.status}`);
    if (!body.providerJobId && !body.id) throw new Error('Video provider did not return a job id');
    return { providerJobId: body.providerJobId ?? body.id!, status: body.status ?? 'queued', progress: body.progress, outputAssets: body.outputAssets, error: body.error };
  }

  async getStatus(providerJobId: string): Promise<ProviderJob> {
    if (!this.endpoint || !process.env.VIDEO_PROVIDER_API_KEY) throw new Error('Video provider is not configured');
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/${encodeURIComponent(providerJobId)}`, { headers: { authorization: `Bearer ${process.env.VIDEO_PROVIDER_API_KEY}` } });
    const body = await response.json() as Partial<ProviderJob> & { id?: string; error?: string };
    if (!response.ok) throw new Error(body.error ?? `Video provider status error: ${response.status}`);
    return { providerJobId: body.providerJobId ?? body.id ?? providerJobId, status: body.status ?? 'processing', progress: body.progress, outputAssets: body.outputAssets, error: body.error };
  }
}
