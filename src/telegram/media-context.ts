import type { MediaAsset } from '../gemini/types.js';
import type { IncomingTelegramAsset } from './media-extractor.js';

export function toGeminiAssets(assets: IncomingTelegramAsset[]): MediaAsset[] {
  return assets.map((asset, index) => ({
    id: `telegram:${asset.fileId}:${index}`,
    type: asset.type,
    mimeType: asset.mimeType,
    telegramFileId: asset.fileId
  }));
}
