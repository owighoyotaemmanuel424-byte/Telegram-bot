import { GeminiService } from '../gemini/service.js';
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
  constructor(private readonly api: TelegramApi, private readonly gemini: GeminiService) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message) return;

    const input = message.text ?? message.caption ?? this.mediaPrompt(message);
    if (!input) return;

    if (input === '/start' || input === '/menu') {
      await this.api.sendMessage(String(message.chat.id), '🤖 Gemini AI Media Assistant\n\nSend me a message or media with a natural-language instruction.', menu);
      return;
    }
    if (input === '/help') {
      await this.api.sendMessage(String(message.chat.id), 'Send text, photos, videos, audio, voice messages, or documents and tell me what you want done. I will plan the workflow with Gemini.');
      return;
    }

    const assets = this.extractAssets(message);
    const status = await this.api.sendMessage(String(message.chat.id), '🧠 Analyzing your request with Gemini...');
    const plan = await this.gemini.plan(input, assets);

    if (plan.intent === 'chat') {
      const answer = await this.gemini.chat(input);
      await this.api.editMessage(String(message.chat.id), (status as { message_id: number }).message_id, answer);
      return;
    }

    await this.api.editMessage(
      String(message.chat.id),
      (status as { message_id: number }).message_id,
      `✅ Plan ready\n\nTask: ${plan.operation}\nType: ${plan.inputType}\nTools: ${plan.tools.join(', ') || 'none'}\n\nThe media worker will execute this workflow once the configured provider is available.`
    );
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
