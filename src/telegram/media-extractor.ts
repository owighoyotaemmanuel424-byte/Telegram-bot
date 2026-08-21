import type { MediaAsset } from '../gemini/types.js';
import type { TelegramMessage } from './types.js';

export interface IncomingTelegramAsset {
  fileId: string;
  type: MediaAsset['type'];
  mimeType: string;
  caption?: string;
}

export function extractTelegramAssets(message: TelegramMessage): IncomingTelegramAsset[] {
  const assets: IncomingTelegramAsset[] = [];
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    if (photo) assets.push({ fileId: photo.file_id, type: 'image', mimeType: 'image/jpeg', ...(message.caption !== undefined ? { caption: message.caption } : {}) });
  }
  if (message.video) assets.push({ fileId: message.video.file_id, type: 'video', mimeType: message.video.mime_type ?? 'video/mp4', ...(message.caption !== undefined ? { caption: message.caption } : {}) });
  if (message.audio) assets.push({ fileId: message.audio.file_id, type: 'audio', mimeType: message.audio.mime_type ?? 'audio/mpeg', ...(message.caption !== undefined ? { caption: message.caption } : {}) });
  if (message.voice) assets.push({ fileId: message.voice.file_id, type: 'audio', mimeType: message.voice.mime_type ?? 'audio/ogg', ...(message.caption !== undefined ? { caption: message.caption } : {}) });
  if (message.document) assets.push({ fileId: message.document.file_id, type: 'document', mimeType: message.document.mime_type ?? 'application/octet-stream', ...(message.caption !== undefined ? { caption: message.caption } : {}) });
  return assets;
}

export function getRequestText(message: TelegramMessage): string {
  return (message.text ?? message.caption ?? '').trim();
}
