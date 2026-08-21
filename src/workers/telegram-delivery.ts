import { TelegramApi } from '../telegram/api.js';

export async function deliverVideoResult(api: TelegramApi, chatId: string, outputUrl: string, caption = '🎬 Your video is ready.') {
  const response = await fetch(outputUrl);
  if (!response.ok) throw new Error(`Unable to download generated media: ${response.status}`);
  // Telegram accepts an HTTPS URL for sendVideo, avoiding an unnecessary
  // in-memory Buffer and keeping the worker lightweight.
  const message = await api.sendVideo(chatId, outputUrl, caption);
  void response.body?.cancel();
  return message;
}
