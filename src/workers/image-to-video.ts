import type { MediaAsset } from '../gemini/types.js';
import type { MediaProvider, ProviderJob } from '../providers/types.js';
import { waitForProvider } from './provider-poller.js';

export interface ImageToVideoRequest { prompt: string; assets: MediaAsset[]; options: Record<string, unknown>; }

export class ImageToVideoWorker {
  constructor(private readonly provider: MediaProvider) {}

  async start(request: ImageToVideoRequest): Promise<ProviderJob> {
    if (!request.assets.some(asset => asset.type === 'image')) throw new Error('Image-to-video requires at least one image asset');
    const created = await this.provider.create({ operation: 'image_to_video', prompt: request.prompt, assets: request.assets, options: request.options });
    if (created.status === 'failed') throw new Error(created.error ?? 'Provider rejected the generation job');
    return created;
  }

  async run(request: ImageToVideoRequest) {
    const created = await this.start(request);
    return waitForProvider(this.provider, created.providerJobId);
  }
}
