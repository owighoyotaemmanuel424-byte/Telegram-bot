import { TelegramGeminiAgent } from '../gemini/telegram-agent.js';
import { TelegramApi } from './api.js';
import { TelegramMediaService } from './media.js';
import { TelegramMediaIngestion } from '../storage/media-ingestion.js';
import { S3MediaStorage } from '../storage/s3.js';
import { ConvexHttpClient } from '../convex/http-client.js';
import type { TelegramMessage, TelegramUpdate } from './types.js';

const menu = { inline_keyboard: [[{ text: '💬 AI Chat', callback_data: 'chat' }, { text: '🎨 Create Image', callback_data: 'image' }], [{ text: '🎬 Create Video', callback_data: 'video' }, { text: '🖼 Edit Photo', callback_data: 'edit_image' }], [{ text: '🎞 Edit Video', callback_data: 'edit_video' }, { text: '🎙 Audio & Voice', callback_data: 'audio' }], [{ text: '📄 Documents', callback_data: 'documents' }, { text: '🧰 Utilities', callback_data: 'utilities' }]] };
type OutputAsset = { type?: string; uri?: string; telegramFileId?: string };

export class TelegramHandlers {
  private readonly mediaIngestion?: TelegramMediaIngestion;
  private readonly convex?: ConvexHttpClient;
  constructor(private readonly api: TelegramApi, private readonly agent: TelegramGeminiAgent) {
    if (process.env.CONVEX_URL && process.env.AGENT_GATEWAY_SECRET && process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY) { this.mediaIngestion = new TelegramMediaIngestion(new TelegramMediaService(api), new S3MediaStorage()); this.convex = new ConvexHttpClient(); }
  }
  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message; if (!message) return;
    const input = message.text ?? message.caption ?? this.mediaPrompt(message); if (!input) return;
    const chatId = String(message.chat.id);
    if (input === '/start' || input === '/menu') { await this.api.sendMessage(chatId, '🤖 Gemini AI Media Assistant\n\nSend me a message or media with a natural-language instruction.', menu); return; }
    if (input === '/help') { await this.api.sendMessage(chatId, 'Send text, photos, videos, audio, voice messages, or documents and tell me what you want done. Gemini will decide which tools to use.'); return; }
    const telegramId = String(message.from?.id ?? message.chat.id);
    const status = await this.api.sendMessage(chatId, '🧠 Gemini is analyzing your request...');
    try {
      if (!this.convex) throw new Error('Persistent Convex conversation context is not configured');
      const userId = await this.convex.getOrCreateTelegramUser({ telegramId, username: message.from?.username, firstName: message.from?.first_name, lastName: message.from?.last_name });
      const conversationId = await this.convex.getOrCreateConversation(userId, `Telegram ${telegramId}`);
      let assets = this.extractAssets(message);
      if (this.mediaIngestion && assets.length) {
        const stored = await this.mediaIngestion.ingest(message, userId);
        const persisted = [] as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; telegramFileId: string; storageKey: string }>;
        for (const asset of stored) { const id = await this.convex.createMediaAsset({ userId, telegramFileId: asset.telegramFileId, storageKey: asset.key, type: asset.type, mimeType: asset.mimeType, conversationId }); await this.convex.setActiveAsset(conversationId, userId, id); persisted.push({ id, type: asset.type, mimeType: asset.mimeType, telegramFileId: asset.telegramFileId, storageKey: asset.key }); }
        assets = persisted;
      }
      await this.convex.addMessage(conversationId, userId, 'user', input);
      const context = await this.convex.getConversationContext(conversationId, userId);
      const history = (context.messages ?? []).map((m: { role: 'user' | 'assistant' | 'tool'; text: string }) => ({ role: m.role, text: m.text }));
      const active = context.activeAsset ? { id: String(context.activeAsset._id), type: context.activeAsset.type, mimeType: context.activeAsset.mimeType, storageKey: context.activeAsset.storageKey } : null;
      const result = await this.agent.run({ userPrompt: input, assets, activeAsset: active, conversationHistory: history, userId: telegramId, chatId, conversationId });
      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map(part => part.text).filter(Boolean).join('') || '✅ Workflow queued.';
      await this.convex.addMessage(conversationId, userId, 'assistant', text);
      await this.api.editMessage(chatId, (status as { message_id: number }).message_id, text);
      const outputs = this.extractOutputAssets(result);
      for (const output of outputs) await this.sendOutput(chatId, output);
    } catch (error) { await this.api.editMessage(chatId, (status as { message_id: number }).message_id, `❌ ${error instanceof Error ? error.message : 'The AI workflow failed.'}`); }
  }
  private extractOutputAssets(result: unknown): OutputAsset[] {
    const outputs: OutputAsset[] = [];
    const visit = (value: unknown) => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { value.forEach(visit); return; } const object = value as Record<string, unknown>; const uri = typeof object.uri === 'string' ? object.uri : undefined; const telegramFileId = typeof object.telegramFileId === 'string' ? object.telegramFileId : undefined; const type = typeof object.type === 'string' ? object.type : undefined; if ((uri || telegramFileId) && type) outputs.push({ uri, telegramFileId, type }); Object.entries(object).filter(([key]) => key === 'outputAssets' || key === 'result' || key === 'data').forEach(([, child]) => visit(child)); };
    visit(result); return outputs;
  }
  private async sendOutput(chatId: string, output: OutputAsset) { const target = output.telegramFileId ?? output.uri; if (!target) return; if (output.type === 'video') await this.api.sendVideo(chatId, target, '🎬 Generated video'); else if (output.type === 'image') await this.api.sendPhoto(chatId, target, '🖼 Generated image'); else if (output.type === 'audio') await this.api.sendAudio(chatId, target, '🎙 Generated audio'); else await this.api.sendDocument(chatId, target, '📄 Generated file'); }
  private mediaPrompt(message: TelegramMessage): string | undefined { return message.photo || message.video || message.audio || message.voice || message.document ? 'Analyze this media and determine the best action.' : undefined; }
  private extractAssets(message: TelegramMessage) { const assets = [] as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; telegramFileId: string }>; if (message.photo?.length) { const photo = message.photo[message.photo.length - 1]; if (photo) assets.push({ id: `tg-${photo.file_id}`, type: 'image', mimeType: 'image/jpeg', telegramFileId: photo.file_id }); } if (message.video) assets.push({ id: `tg-${message.video.file_id}`, type: 'video', mimeType: message.video.mime_type ?? 'video/mp4', telegramFileId: message.video.file_id }); if (message.audio) assets.push({ id: `tg-${message.audio.file_id}`, type: 'audio', mimeType: message.audio.mime_type ?? 'audio/mpeg', telegramFileId: message.audio.file_id }); if (message.voice) assets.push({ id: `tg-${message.voice.file_id}`, type: 'audio', mimeType: message.voice.mime_type ?? 'audio/ogg', telegramFileId: message.voice.file_id }); if (message.document) assets.push({ id: `tg-${message.document.file_id}`, type: 'document', mimeType: message.document.mime_type ?? 'application/octet-stream', telegramFileId: message.document.file_id }); return assets; }
}
