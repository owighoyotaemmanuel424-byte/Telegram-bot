import { mkdir, stat } from 'node:fs/promises';
import { TelegramFileService } from '../telegram/files.js';
import { assertAllowedMime } from './mime.js';
import type { IncomingTelegramAsset } from '../telegram/media-extractor.js';

export interface StoredTelegramAsset {
  fileId: string;
  localPath: string;
  type: IncomingTelegramAsset['type'];
  mimeType: string;
}

export class TelegramMediaIngestionService {
  constructor(private readonly files = new TelegramFileService()) {}

  async ingest(asset: IncomingTelegramAsset, workDir: string): Promise<StoredTelegramAsset> {
    assertAllowedMime(asset.mimeType);
    await mkdir(workDir, { recursive: true });
    const downloaded = await this.files.download(asset.fileId, workDir);
    const info = await stat(downloaded.path);
    if (info.size === 0) throw new Error('Telegram returned an empty media file');
    return { fileId: asset.fileId, localPath: downloaded.path, type: asset.type, mimeType: asset.mimeType };
  }
}
