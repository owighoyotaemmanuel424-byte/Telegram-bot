import { TelegramApi } from '../telegram/api.js';

export async function deliverVideoResult(api: TelegramApi, chatId: string, outputUrl: string, caption = '🎬 Your video is ready.') {
  const response = await fetch(outputUrl);
  if (!response.ok) throw new Error(`Unable to download generated media: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const message = await api.sendVideo(chatId, bytes, caption);
  return message;
}
