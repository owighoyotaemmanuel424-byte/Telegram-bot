import type { MediaAsset } from '../gemini/types.js';
import type { MediaProvider, ProviderCapabilities, ProviderJob } from './types.js';

export class VideoProviderAdapter implements MediaProvider {
  readonly name = 'configured-video-provider';
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: false,
    imageEditing: false,
    imageToVideo: true,
    textToVideo: true,
    videoEditing: false,
    audioGeneration: false,
    transcription: false,
    upscaling: false
  };

  async create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }): Promise<ProviderJob> {
    if (!process.env.VIDEO_PROVIDER_API_KEY) throw new Error('VIDEO_PROVIDER_API_KEY is not configured');
    // Provider-specific HTTP integration belongs here. The core orchestrator never depends on a vendor SDK.
    throw new Error(`Video provider adapter is configured but not implemented for operation: ${input.operation}`);
  }

  async getStatus(_providerJobId: string): Promise<ProviderJob> {
    if (!process.env.VIDEO_PROVIDER_API_KEY) throw new Error('VIDEO_PROVIDER_API_KEY is not configured');
    throw new Error('Video provider status adapter is not implemented');
  }
}
