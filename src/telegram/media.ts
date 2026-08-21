import { config } from '../config.js';
import { TelegramApi } from './api.js';

export interface DownloadedTelegramAsset {
  telegramFileId: string;
  filePath: string;
  mimeType: string;
  bytes: Uint8Array;
}

const MAX_BYTES = 50 * 1024 * 1024;

export class TelegramMediaService {
  constructor(private readonly api: TelegramApi, private readonly token = config.TELEGRAM_BOT_TOKEN) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  async download(fileId: string, mimeType: string): Promise<DownloadedTelegramAsset> {
    const file = await this.api.call<{ file_path?: string }>('getFile', { file_id: fileId });
    if (!file.file_path) throw new Error('Telegram did not return a file path');
    if (file.file_path.includes('..') || file.file_path.startsWith('/')) throw new Error('Unsafe Telegram file path');
    const url = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Telegram media download failed: ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BYTES) throw new Error('Media file exceeds the 50 MB application limit');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error('Media file exceeds the 50 MB application limit');
    return { telegramFileId: fileId, filePath: file.file_path, mimeType, bytes };
  }
}
