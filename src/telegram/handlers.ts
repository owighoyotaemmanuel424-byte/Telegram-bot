import { TelegramGeminiAgent } from '../gemini/telegram-agent.js';
import { TelegramApi } from './api.js';
import { TelegramMediaService } from './media.js';
import { TelegramMediaIngestion } from '../storage/media-ingestion.js';
import { S3MediaStorage } from '../storage/s3.js';
import { ConvexHttpClient } from '../convex/http-client.js';
import { AppBuilderService } from '../app-builder/service.js';
import type { TelegramMessage, TelegramUpdate } from './types.js';

const menu = { inline_keyboard: [[{ text: '💬 AI Chat', callback_data: 'chat' }, { text: '🏗️ Build App', callback_data: 'build' }], [{ text: '🚀 Deploy App', callback_data: 'deploy' }, { text: '📊 Build Status', callback_data: 'status' }], [{ text: '🎨 Create Image', callback_data: 'image' }, { text: '🎬 Create Video', callback_data: 'video' }]] };
type OutputAsset = { type?: string; uri?: string; telegramFileId?: string };

export class TelegramHandlers {
  private readonly mediaIngestion?: TelegramMediaIngestion;
  private readonly convex?: ConvexHttpClient;
  private readonly builds = new Map<string, { status: 'queued' | 'building' | 'completed' | 'failed'; message: string; updatedAt: number; branch?: string; projectName?: string }>();

  constructor(private readonly api: TelegramApi, private readonly agent: TelegramGeminiAgent, private readonly appBuilder?: AppBuilderService) {
    if (process.env.CONVEX_URL && process.env.AGENT_GATEWAY_SECRET) this.convex = new ConvexHttpClient();
    if (process.env.CONVEX_URL && process.env.AGENT_GATEWAY_SECRET && process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY) this.mediaIngestion = new TelegramMediaIngestion(new TelegramMediaService(api), new S3MediaStorage());
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const message = update.message; if (!message) return;
    const input = message.text ?? message.caption ?? this.mediaPrompt(message); if (!input) return;
    const chatId = String(message.chat.id); const telegramId = String(message.from?.id ?? message.chat.id);
    if (input === '/start' || input === '/menu') { await this.api.sendMessage(chatId, '🤖 AI App Builder + Media Assistant\n\n/build <description> — generate an app\n/deploy <branch> — deploy an existing generated branch\n/status — show your latest build', menu); return; }
    if (input === '/help') { await this.api.sendMessage(chatId, '🏗️ /build <description> — generate an app\n🚀 /deploy <branch> — deploy an existing branch\n📊 /status — latest build status\n\n💬 Send normal text/media for the existing AI assistant.'); return; }
    if (input === '/status') { const build = this.builds.get(telegramId); await this.api.sendMessage(chatId, build ? `🏗️ Build status: ${build.status}\n\n${build.message}${build.branch ? `\n🌿 ${build.branch}` : ''}${build.projectName ? `\n📱 ${build.projectName}` : ''}` : 'No app build has been started yet. Use /build <what you want to build>.'); return; }
    if (input.startsWith('/deploy')) { await this.handleDeploy(chatId, telegramId, input.slice('/deploy'.length).trim()); return; }
    if (input.startsWith('/build')) { await this.handleBuild(chatId, telegramId, input.slice('/build'.length).trim()); return; }

    const status = await this.api.sendMessage(chatId, '🧠 Gemini is analyzing your request...'); const statusMessageId = (status as { message_id: number }).message_id;
    try {
      if (!this.convex) throw new Error('Persistent Convex conversation context is not configured.');
      const userId = await this.convex.getOrCreateTelegramUser({ telegramId, username: message.from?.username, firstName: message.from?.first_name, lastName: message.from?.last_name });
      const conversationId = await this.convex.getOrCreateConversation(userId, `Telegram ${telegramId}`);
      let assets = this.extractAssets(message);
      if (this.mediaIngestion && assets.length) { const stored = await this.mediaIngestion.ingest(message, userId); const persisted = [] as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; telegramFileId: string; storageKey: string }>; for (const asset of stored) { const id = await this.convex.createMediaAsset({ userId, telegramFileId: asset.telegramFileId, storageKey: asset.key, type: asset.type, mimeType: asset.mimeType, conversationId }); await this.convex.setActiveAsset(conversationId, userId, id); persisted.push({ id, type: asset.type, mimeType: asset.mimeType, telegramFileId: asset.telegramFileId, storageKey: asset.key }); } assets = persisted; }
      await this.convex.addMessage(conversationId, userId, 'user', input); const context = await this.convex.getConversationContext(conversationId, userId); const history = (context.messages ?? []).map((m: { role: 'user' | 'assistant' | 'tool'; text: string }) => ({ role: m.role, text: m.text })); const active = context.activeAsset ? { id: String(context.activeAsset._id), type: context.activeAsset.type, mimeType: context.activeAsset.mimeType, storageKey: context.activeAsset.storageKey } : null;
      const result = await this.agent.run({ userPrompt: input, assets, activeAsset: active, conversationHistory: history, userId: telegramId, chatId, statusMessageId, conversationId }); const parts = result.response.candidates?.[0]?.content?.parts ?? []; const text = parts.map(part => part.text).filter(Boolean).join('') || '✅ Workflow queued.'; await this.convex.addMessage(conversationId, userId, 'assistant', text); await this.api.editMessage(chatId, statusMessageId, text); for (const output of this.extractOutputAssets(result)) await this.sendOutput(chatId, output);
    } catch (error) { await this.api.editMessage(chatId, statusMessageId, `❌ ${error instanceof Error ? error.message : 'The AI workflow failed.'}`); }
  }

  private async handleBuild(chatId: string, telegramId: string, prompt: string): Promise<void> {
    if (!prompt) { await this.api.sendMessage(chatId, '🏗️ Tell me what to build.\n\n/build Build a modern restaurant ordering app with login, menu, cart and checkout.'); return; }
    if (!this.appBuilder || !process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPOSITORY) { await this.api.sendMessage(chatId, '⚠️ App Builder is not configured. Set Gemini and GitHub settings on the server.'); return; }
    this.builds.set(telegramId, { status: 'building', message: 'Generating project…', updatedAt: Date.now() }); const status = await this.api.sendMessage(chatId, '🏗️ Starting app build…\n\n1/3 🧠 Designing\n2/3 💻 Generating code\n3/3 🐙 Publishing to GitHub'); const statusMessageId = (status as { message_id: number }).message_id;
    try { const result = await this.appBuilder.generate(prompt, process.env.GITHUB_OWNER, process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN); this.builds.set(telegramId, { status: 'completed', message: `${result.summary}\n📦 ${result.files.length} files`, updatedAt: Date.now(), branch: result.branch, projectName: result.projectName }); await this.api.editMessage(chatId, statusMessageId, `✅ APP GENERATED\n\n📱 ${result.projectName}\n\n${result.summary}\n\n📦 ${result.files.length} files\n🌿 Branch: ${result.branch}\n🐙 ${result.repositoryUrl}/tree/${result.branch}/generated/${result.slug}\n\n🚀 Run /deploy ${result.branch}`); } catch (error) { const text = error instanceof Error ? error.message : 'App build failed.'; this.builds.set(telegramId, { status: 'failed', message: text, updatedAt: Date.now() }); await this.api.editMessage(chatId, statusMessageId, `❌ APP BUILD FAILED\n\n${text}`); }
  }

  private async handleDeploy(chatId: string, telegramId: string, branch: string): Promise<void> {
    const saved = this.builds.get(telegramId); const selectedBranch = branch || saved?.branch; const projectName = saved?.projectName || 'Telegram Generated App';
    if (!selectedBranch) { await this.api.sendMessage(chatId, '🚀 Usage: /deploy <generated-branch>\n\nOr run /status first if you already generated an app.'); return; }
    if (!this.appBuilder || !process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPOSITORY || !process.env.VERCEL_TOKEN) { await this.api.sendMessage(chatId, '⚠️ Deployment is not configured. Set GitHub and VERCEL_TOKEN on the server.'); return; }
    const status = await this.api.sendMessage(chatId, `🚀 Deploying ${selectedBranch} to Vercel…\n\n⏳ Waiting for Vercel to finish.`); const statusMessageId = (status as { message_id: number }).message_id;
    try { const deployment = await this.appBuilder.deployExistingBranch(process.env.GITHUB_OWNER, process.env.GITHUB_REPOSITORY, selectedBranch, projectName); this.builds.set(telegramId, { status: 'completed', message: `🌐 ${deployment.url}`, updatedAt: Date.now(), branch: selectedBranch, projectName }); await this.api.editMessage(chatId, statusMessageId, `🎉 DEPLOYMENT COMPLETE\n\n📱 ${projectName}\n🌐 ${deployment.url}\n🌿 ${selectedBranch}\n\nYour app is live.`); } catch (error) { const text = error instanceof Error ? error.message : 'Deployment failed.'; this.builds.set(telegramId, { status: 'failed', message: text, updatedAt: Date.now(), branch: selectedBranch, projectName }); await this.api.editMessage(chatId, statusMessageId, `❌ DEPLOYMENT FAILED\n\n${text}`); }
  }

  private extractOutputAssets(result: unknown): OutputAsset[] { const outputs: OutputAsset[] = []; const visit = (value: unknown) => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { value.forEach(visit); return; } const object = value as Record<string, unknown>; const uri = typeof object.uri === 'string' ? object.uri : undefined; const telegramFileId = typeof object.telegramFileId === 'string' ? object.telegramFileId : undefined; const type = typeof object.type === 'string' ? object.type : undefined; if ((uri || telegramFileId) && type) outputs.push({ uri, telegramFileId, type }); Object.entries(object).filter(([key]) => key === 'outputAssets' || key === 'result' || key === 'data').forEach(([, child]) => visit(child)); }; visit(result); return outputs; }
  private async sendOutput(chatId: string, output: OutputAsset) { const target = output.telegramFileId ?? output.uri; if (!target) return; if (output.type === 'video') await this.api.sendVideo(chatId, target, '🎬 Generated video'); else if (output.type === 'image') await this.api.sendPhoto(chatId, target, '🖼 Generated image'); else if (output.type === 'audio') await this.api.sendAudio(chatId, target, '🎙 Generated audio'); else await this.api.sendDocument(chatId, target, '📄 Generated file'); }
  private mediaPrompt(message: TelegramMessage): string | undefined { return message.photo || message.video || message.audio || message.voice || message.document ? 'Analyze this media and determine the best action.' : undefined; }
  private extractAssets(message: TelegramMessage) { const assets = [] as Array<{ id: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; telegramFileId: string }>; if (message.photo?.length) { const photo = message.photo[message.photo.length - 1]; if (photo) assets.push({ id: `tg-${photo.file_id}`, type: 'image', mimeType: 'image/jpeg', telegramFileId: photo.file_id }); } if (message.video) assets.push({ id: `tg-${message.video.file_id}`, type: 'video', mimeType: message.video.mime_type ?? 'video/mp4', telegramFileId: message.video.file_id }); if (message.audio) assets.push({ id: `tg-${message.audio.file_id}`, type: 'audio', mimeType: message.audio.mime_type ?? 'audio/mpeg', telegramFileId: message.audio.file_id }); if (message.voice) assets.push({ id: `tg-${message.voice.file_id}`, type: 'audio', mimeType: message.voice.mime_type ?? 'audio/ogg', telegramFileId: message.voice.file_id }); if (message.document) assets.push({ id: `tg-${message.document.file_id}`, type: 'document', mimeType: message.document.mime_type ?? 'application/octet-stream', telegramFileId: message.document.file_id }); return assets; }
}
