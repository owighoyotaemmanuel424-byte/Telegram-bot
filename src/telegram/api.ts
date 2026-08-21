import { config } from '../config.js';

export class TelegramApi {
  private readonly baseUrl: string;

  constructor(private readonly token = config.TELEGRAM_BOT_TOKEN) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    const payload = await response.json() as { ok: boolean; result?: T; description?: string };
    if (!response.ok || !payload.ok) throw new Error(payload.description ?? `Telegram API error: ${response.status}`);
    return payload.result as T;
  }

  sendMessage(chatId: string, text: string, replyMarkup?: unknown) { return this.call('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup }); }
  editMessage(chatId: string, messageId: number, text: string) { return this.call('editMessageText', { chat_id: chatId, message_id: messageId, text }); }
  sendVideo(chatId: string, video: string, caption?: string) { return this.call('sendVideo', { chat_id: chatId, video, caption }); }
  sendPhoto(chatId: string, photo: string, caption?: string) { return this.call('sendPhoto', { chat_id: chatId, photo, caption }); }
  sendAudio(chatId: string, audio: string, caption?: string) { return this.call('sendAudio', { chat_id: chatId, audio, caption }); }
  sendDocument(chatId: string, document: string, caption?: string) { return this.call('sendDocument', { chat_id: chatId, document, caption }); }
  setWebhook(url: string, secretToken?: string) { return this.call('setWebhook', { url, secret_token: secretToken }); }
}
