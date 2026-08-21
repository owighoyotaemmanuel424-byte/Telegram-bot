import { S3MediaStorage } from './s3.js';
import { TelegramMediaService } from '../telegram/media.js';
import type { TelegramMessage } from '../telegram/types.js';

export interface StoredTelegramAsset {
  telegramFileId: string;
  key: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
  bytes: number;
}

export class TelegramMediaIngestion {
  constructor(private readonly telegram: TelegramMediaService, private readonly storage: S3MediaStorage) {}

  async ingest(message: TelegramMessage, userId: string): Promise<StoredTelegramAsset[]> {
    const files: Array<{ id: string; mime: string; type: StoredTelegramAsset['type'] }> = [];
    if (message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      if (photo) files.push({ id: photo.file_id, mime: 'image/jpeg', type: 'image' });
    }
    if (message.video) files.push({ id: message.video.file_id, mime: message.video.mime_type ?? 'video/mp4', type: 'video' });
    if (message.audio) files.push({ id: message.audio.file_id, mime: message.audio.mime_type ?? 'audio/mpeg', type: 'audio' });
    if (message.voice) files.push({ id: message.voice.file_id, mime: message.voice.mime_type ?? 'audio/ogg', type: 'audio' });
    if (message.document) files.push({ id: message.document.file_id, mime: message.document.mime_type ?? 'application/octet-stream', type: 'document' });

    const stored: StoredTelegramAsset[] = [];
    for (const file of files) {
      const downloaded = await this.telegram.download(file.id, file.mime);
      const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const key = `telegram/${safeUser}/${Date.now()}-${file.id}`;
      await this.storage.put({ key, body: downloaded.bytes, contentType: downloaded.mimeType });
      stored.push({ telegramFileId: file.id, key, mimeType: downloaded.mimeType, type: file.type, bytes: downloaded.bytes.byteLength });
    }
    return stored;
  }
}
