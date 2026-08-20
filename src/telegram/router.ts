import { TelegramApi } from './api.js';
import type { TelegramMessage } from './types.js';
import { TelegramWorkflowHandler } from './workflow-handler.js';

export interface TelegramUpdate { message?: TelegramMessage; }

export class TelegramRouter {
  constructor(private readonly api: TelegramApi, private readonly workflow: TelegramWorkflowHandler) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message) return;
    const text = (message as TelegramMessage & { text?: string }).text?.trim();
    if (!text) {
      await this.api.sendMessage(String(message.chat.id), '📎 I received your media. Send a description of what you want me to do with it.');
      return;
    }
    await this.workflow.process(message, text, []);
  }
}
