import { GeminiToolDispatcher } from './tool-dispatcher.js';

export interface MediaToolDeps {
  image?: { generate(args: { prompt: string; aspectRatio?: string }): Promise<unknown>; edit(args: { prompt: string; assetIds: string[] }): Promise<unknown> };
  audio?: { transcribe(args: { assetId: string; language?: string }): Promise<unknown> };
  documents?: { analyze(args: { assetId: string; question?: string }): Promise<unknown> };
  media?: { convert(args: { assetId: string; targetFormat: string; quality?: string }): Promise<unknown>; editVideo(args: { instructions: string; assetIds: string[] }): Promise<unknown> };
}

export function registerDeterministicTools(dispatcher: GeminiToolDispatcher, deps: MediaToolDeps) {
  if (deps.image) {
    dispatcher.register('generate_image', async args => {
      if (typeof args.prompt !== 'string' || !args.prompt.trim()) throw new Error('generate_image requires prompt');
      return deps.image!.generate({ prompt: args.prompt, aspectRatio: typeof args.aspect_ratio === 'string' ? args.aspect_ratio : undefined });
    });
    dispatcher.register('edit_image', async args => {
      const assetIds = Array.isArray(args.asset_ids) ? args.asset_ids.filter((x): x is string => typeof x === 'string') : [];
      if (!assetIds.length || typeof args.prompt !== 'string') throw new Error('edit_image requires prompt and asset_ids');
      return deps.image!.edit({ prompt: args.prompt, assetIds });
    });
  }
  if (deps.audio) dispatcher.register('transcribe_audio', async args => {
    if (typeof args.asset_id !== 'string') throw new Error('transcribe_audio requires asset_id');
    return deps.audio!.transcribe({ assetId: args.asset_id, language: typeof args.language === 'string' ? args.language : undefined });
  });
  if (deps.documents) dispatcher.register('analyze_document', async args => {
    if (typeof args.asset_id !== 'string') throw new Error('analyze_document requires asset_id');
    return deps.documents!.analyze({ assetId: args.asset_id, question: typeof args.question === 'string' ? args.question : undefined });
  });
  if (deps.media) {
    dispatcher.register('convert_media', async args => {
      if (typeof args.asset_id !== 'string' || typeof args.target_format !== 'string') throw new Error('convert_media requires asset_id and target_format');
      return deps.media!.convert({ assetId: args.asset_id, targetFormat: args.target_format, quality: typeof args.quality === 'string' ? args.quality : undefined });
    });
    dispatcher.register('edit_video', async args => {
      const assetIds = Array.isArray(args.asset_ids) ? args.asset_ids.filter((x): x is string => typeof x === 'string') : [];
      if (!assetIds.length || typeof args.instructions !== 'string') throw new Error('edit_video requires instructions and asset_ids');
      return deps.media!.editVideo({ instructions: args.instructions, assetIds });
    });
  }
}
