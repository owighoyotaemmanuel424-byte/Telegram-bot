import { randomUUID } from 'node:crypto';
import { GeminiAgentLoop } from './agent-loop.js';
import { GeminiToolDispatcher, type ToolContext } from './tool-dispatcher.js';
import type { GeminiClient, GeminiContent } from './client.js';
import type { MediaAsset } from './types.js';
import { S3MediaStorage } from '../storage/s3.js';

export interface TelegramAgentInput {
  userPrompt: string;
  assets?: Array<{ id: string; type: string; mimeType: string; storageKey?: string }>;
  userId: string;
  jobId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'tool'; text: string }>;
  activeAsset?: { id: string; type: string; mimeType: string; storageKey?: string } | null;
}

const MAX_INLINE_MEDIA_BYTES = 20 * 1024 * 1024;

export class TelegramGeminiAgent {
  private readonly loop: GeminiAgentLoop;
  private readonly storage?: S3MediaStorage;
  constructor(client: GeminiClient, dispatcher: GeminiToolDispatcher, storage?: S3MediaStorage) { this.loop = new GeminiAgentLoop(client, dispatcher); this.storage = storage; }

  async run(input: TelegramAgentInput) {
    const assets: MediaAsset[] = (input.assets ?? []).map(a => ({ id: a.id, type: a.type as MediaAsset['type'], mimeType: a.mimeType, storageKey: a.storageKey }));
    if (input.activeAsset && !assets.some(a => a.id === input.activeAsset!.id)) assets.push({ id: input.activeAsset.id, type: input.activeAsset.type as MediaAsset['type'], mimeType: input.activeAsset.mimeType, storageKey: input.activeAsset.storageKey });
    const requestId = input.jobId ?? randomUUID();
    const context: ToolContext = { userId: input.userId, jobId: input.jobId, requestId, assets };
    const history = input.conversationHistory?.slice(-20) ?? [];
    const active = input.activeAsset ? `Active asset: ${input.activeAsset.id} (${input.activeAsset.type}, ${input.activeAsset.mimeType})${input.activeAsset.storageKey ? `, storage=${input.activeAsset.storageKey}` : ''}` : 'Active asset: none';
    const attached = assets.length ? `Attached media: ${assets.map(a => `${a.id} (${a.type}, ${a.mimeType})`).join(', ')}` : '';
    const contents: GeminiContent[] = history.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: `${message.role}: ${message.text}` }] }));

    if (this.storage) {
      for (const asset of assets) {
        if (!asset.storageKey) continue;
        const bytes = await this.storage.get(asset.storageKey);
        if (bytes.byteLength > MAX_INLINE_MEDIA_BYTES) continue;
        contents.push({ role: 'user', parts: [{ inlineData: { mimeType: asset.mimeType, data: Buffer.from(bytes).toString('base64') } }] });
      }
    }

    contents.push({ role: 'user', parts: [{ text: `${active}${attached}\n\nCurrent request:\n${input.userPrompt}` }] });
    return this.loop.run({
      systemPrompt: 'You are the production Telegram AI media assistant powered by Gemini 3.5 Flash. Use registered tools for real operations, never claim success without a successful tool result, preserve user intent, inspect supplied multimodal media, maintain conversation context, and return tool results to Gemini before the final Telegram response.',
      userPrompt: input.userPrompt,
      contents,
      context,
      maxToolRounds: 5
    });
  }
}
