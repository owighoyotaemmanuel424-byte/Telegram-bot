import type { MediaProvider } from './types.js';
import { ImageProviderAdapter } from './image.js';
import { VideoProviderAdapter } from './video.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, MediaProvider>();

  constructor() {
    this.providers.set('image', new ImageProviderAdapter());
    this.providers.set('video', new VideoProviderAdapter());
  }

  get(kind: 'image' | 'video'): MediaProvider {
    const provider = this.providers.get(kind);
    if (!provider) throw new Error(`No provider registered for ${kind}`);
    return provider;
  }
}
