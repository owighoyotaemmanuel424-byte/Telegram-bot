import type { MediaProvider } from '../providers/types.js';
import { ImageToVideoWorker } from './image-to-video.js';

export interface JobLike { id: string; intent: string; prompt: string; assets: import('../gemini/types.js').MediaAsset[]; options: Record<string, unknown>; }

export class MediaJobRunner {
  constructor(private readonly videoProvider: MediaProvider) {}

  async run(job: JobLike) {
    switch (job.intent) {
      case 'image_to_video':
        return new ImageToVideoWorker(this.videoProvider).run({ prompt: job.prompt, assets: job.assets, options: job.options });
      default:
        throw new Error(`No worker registered for intent: ${job.intent}`);
    }
  }
}
