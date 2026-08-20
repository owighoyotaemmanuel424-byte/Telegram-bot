import type { MediaAsset } from '../gemini/types.js';

export interface ProviderCapabilities {
  imageGeneration: boolean;
  imageEditing: boolean;
  imageToVideo: boolean;
  textToVideo: boolean;
  videoEditing: boolean;
  audioGeneration: boolean;
  transcription: boolean;
  upscaling: boolean;
}

export interface ProviderJob {
  providerJobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  outputAssets?: MediaAsset[];
  error?: string;
}

export interface MediaProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }): Promise<ProviderJob>;
  getStatus(providerJobId: string): Promise<ProviderJob>;
}
