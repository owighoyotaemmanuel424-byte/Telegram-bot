import { TelegramApi } from './api.js';
import { extractTelegramAssets, getRequestText } from './media-extractor.js';
import { toGeminiAssets } from './media-context.js';
import type { TelegramMessage, TelegramUpdate } from './types.js';
import { TelegramWorkflowHandler } from './workflow-handler.js';

export class TelegramRouter {
  constructor(private readonly api: TelegramApi, private readonly workflow: TelegramWorkflowHandler) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message) return;
    const incoming = extractTelegramAssets(message);
    const text = getRequestText(message);
    if (!text && incoming.length === 0) {
      await this.api.sendMessage(String(message.chat.id), 'Send me a message or upload media with a description of what you want me to do.');
      return;
    }
    if (!text) {
      await this.api.sendMessage(String(message.chat.id), '📎 Media received. Tell me what you want done with it, for example: “turn this into a cinematic 9:16 video”.');
      return;
    }
    await this.workflow.process(message, text, toGeminiAssets(incoming));
  }
}
