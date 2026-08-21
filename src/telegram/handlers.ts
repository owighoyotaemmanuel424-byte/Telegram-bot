import { TelegramGeminiAgent } from '../gemini/telegram-agent.js';
import { TelegramApi } from './api.js';
import type { TelegramMessage, TelegramUpdate } from './types.js';

const menu = {
  inline_keyboard: [
    [{ text: '💬 AI Chat', callback_data: 'chat' }, { text: '🎨 Create Image', callback_data: 'image' }],
    [{ text: '🎬 Create Video', callback_data: 'video' }, { text: '🖼 Edit Photo', callback_data: 'edit_image' }],
    [{ text: '🎞 Edit Video', callback_data: 'edit_video' }, { text: '🎙 Audio & Voice', callback_data: 'audio' }],
    [{ text: '📄 Documents', callback_data: 'documents' }, { text: '🧰 Utilities', callback_data: 'utilities' }]
  ]
};

export class TelegramHandlers {
  constructor(private readonly api: TelegramApi, private readonly agent: TelegramGeminiAgent) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message) return;
    const input = message.text ?? message.caption ?? this.mediaPrompt(message);
    if (!input) return;
    const chatId = String(message.chat.id);

    if (input === '/start' || input === '/menu') {
      await this.api.sendMessage(chatId, '🤖 Gemini AI Media Assistant\n\nSend me a message or media with a natural-language instruction.', menu);
      return;
    }
    if (input === '/help') {
      await this.api.sendMessage(chatId, 'Send text, photos, videos, audio, voice messages, or documents and tell me what you want done. Gemini will decide which tools to use.');
      return;
    }

    const assets = this.extractAssets(message);
    const status = await this.api.sendMessage(chatId, '🧠 Gemini is analyzing your request...');
    try {
      const result = await this.agent.run({ userPrompt: input, assets, userId: String(message.from?.id ?? message.chat.id) });
      const text = result.response.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('') || '✅ Done. I completed the requested workflow.';
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, text);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The AI workflow failed.';
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, `❌ ${messageText}`);
    }
  }

  private mediaPrompt(message: TelegramMessage): string | undefined {
    if (message.photo || message.video || message.audio || message.voice || message.document) return 'Analyze this media and determine the best action.';
    return undefined;
  }

  private extractAssets(message: TelegramMessage) {
    const assets = [] as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; telegramFileId: string }>;
    if (message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      if (photo) assets.push({ id: `tg-${photo.file_id}`, type: 'image', mimeType: 'image/jpeg', telegramFileId: photo.file_id });
    }
    if (message.video) assets.push({ id: `tg-${message.video.file_id}`, type: 'video', mimeType: message.video.mime_type ?? 'video/mp4', telegramFileId: message.video.file_id });
    if (message.audio) assets.push({ id: `tg-${message.audio.file_id}`, type: 'audio', mimeType: message.audio.mime_type ?? 'audio/mpeg', telegramFileId: message.audio.file_id });
    if (message.voice) assets.push({ id: `tg-${message.voice.file_id}`, type: 'audio', mimeType: message.voice.mime_type ?? 'audio/ogg', telegramFileId: message.voice.file_id });
    if (message.document) assets.push({ id: `tg-${message.document.file_id}`, type: 'document', mimeType: message.document.mime_type ?? 'application/octet-stream', telegramFileId: message.document.file_id });
    return assets;
  }
}
