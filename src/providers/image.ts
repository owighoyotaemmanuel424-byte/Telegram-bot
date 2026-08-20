import type { MediaAsset } from '../gemini/types.js';
import type { MediaProvider, ProviderCapabilities, ProviderJob } from './types.js';

export class ImageProviderAdapter implements MediaProvider {
  readonly name = 'configured-image-provider';
  readonly capabilities: ProviderCapabilities = {
    imageGeneration: true,
    imageEditing: true,
    imageToVideo: false,
    textToVideo: false,
    videoEditing: false,
    audioGeneration: false,
    transcription: false,
    upscaling: false
  };

  async create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }): Promise<ProviderJob> {
    if (!process.env.IMAGE_PROVIDER_API_KEY) throw new Error('IMAGE_PROVIDER_API_KEY is not configured');
    throw new Error(`Image provider adapter is configured but not implemented for operation: ${input.operation}`);
  }

  async getStatus(_providerJobId: string): Promise<ProviderJob> {
    if (!process.env.IMAGE_PROVIDER_API_KEY) throw new Error('IMAGE_PROVIDER_API_KEY is not configured');
    throw new Error('Image provider status adapter is not implemented');
  }
}
