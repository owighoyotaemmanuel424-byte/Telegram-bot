import type { GeminiService } from '../gemini/service.js';

export interface TelegramMessage {
  chatId: string;
  text?: string;
  media?: Array<{ fileId: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType?: string }>;
}

export class TelegramBotService {
  constructor(private readonly gemini: GeminiService) {}

  async handleMessage(message: TelegramMessage): Promise<string> {
    const text = message.text?.trim() || 'Analyze the uploaded media and determine the best action.';
    const plan = await this.gemini.plan(text, (message.media ?? []).map((media, index) => ({
      id: `telegram-${index}`,
      type: media.type,
      mimeType: media.mimeType ?? 'application/octet-stream',
      telegramFileId: media.fileId
    })));

    if (plan.intent === 'chat') return this.gemini.chat(text);
    return `I understood this as ${plan.intent}. I will execute: ${plan.operation}.`;
  }
}
