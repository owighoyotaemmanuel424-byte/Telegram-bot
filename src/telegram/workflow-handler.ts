import { GeminiService } from '../gemini/service.js';
import type { MediaAsset } from '../gemini/types.js';
import { TelegramApi } from './api.js';
import type { TelegramMessage } from './types.js';

export interface WorkflowExecutor {
  execute(input: { operation: string; prompt: string; assets: MediaAsset[]; options: Record<string, unknown> }): Promise<{ status: string; outputUrl?: string; message?: string }>;
}

export class TelegramWorkflowHandler {
  constructor(private readonly api: TelegramApi, private readonly gemini: GeminiService, private readonly executor: WorkflowExecutor) {}

  async process(message: TelegramMessage, text: string, assets: MediaAsset[]): Promise<void> {
    const chatId = String(message.chat.id);
    const status = await this.api.sendMessage(chatId, '🧠 Gemini is planning your workflow...');
    try {
      const plan = await this.gemini.plan(text, assets);
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, `🎬 ${plan.operation}\n\n${plan.prompt}\n\n⏳ Starting the media workflow...`);
      const result = await this.executor.execute({ operation: plan.operation, prompt: plan.prompt, assets, options: { duration: plan.duration, aspectRatio: plan.aspectRatio, style: plan.style, needsAudio: plan.needsAudio } });
      const messageText = result.outputUrl ? `✅ Completed\n\n${result.outputUrl}` : `⏳ ${result.message ?? result.status}`;
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, messageText);
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Workflow failed';
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, `❌ ${safeMessage}`);
    }
  }
}
