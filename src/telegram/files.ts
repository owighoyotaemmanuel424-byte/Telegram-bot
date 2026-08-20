import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { config } from '../config.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export class TelegramFileService {
  constructor(private readonly token = config.TELEGRAM_BOT_TOKEN) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  async download(fileId: string, targetDir: string): Promise<{ path: string; mimeType?: string }> {
    const fileResponse = await fetch(`https://api.telegram.org/bot${this.token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const filePayload = await fileResponse.json() as { ok: boolean; result?: { file_path?: string; file_size?: number }; description?: string };
    if (!filePayload.ok || !filePayload.result?.file_path) throw new Error(filePayload.description ?? 'Telegram file lookup failed');
    if ((filePayload.result.file_size ?? 0) > MAX_FILE_SIZE) throw new Error('Telegram file exceeds the 50 MB application limit');

    const pathPart = basename(filePayload.result.file_path);
    const outputDir = join(targetDir, 'telegram');
    await mkdir(outputDir, { recursive: true });
    const output = join(outputDir, pathPart);
    const response = await fetch(`https://api.telegram.org/file/bot${this.token}/${filePayload.result.file_path}`);
    if (!response.ok) throw new Error(`Telegram file download failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_SIZE) throw new Error('Downloaded file exceeds the application limit');
    await writeFile(output, bytes, { flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
      await writeFile(output, bytes);
    });
    return { path: output };
  }
}
