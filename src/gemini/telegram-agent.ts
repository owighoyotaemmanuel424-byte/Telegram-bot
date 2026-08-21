import { GeminiAgentLoop } from './agent-loop.js';
import { GeminiToolDispatcher, type ToolContext } from './tool-dispatcher.js';
import type { GeminiClient, GeminiContent } from './client.js';
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
  constructor(client: GeminiClient, dispatcher: GeminiToolDispatcher, storage?: S3MediaStorage) {
    this.loop = new GeminiAgentLoop(client, dispatcher);
    this.storage = storage;
  }

  async run(input: TelegramAgentInput) {
    const context: ToolContext = { userId: input.userId, jobId: input.jobId };
    const history = input.conversationHistory?.slice(-20) ?? [];
    const active = input.activeAsset ? `Active asset: ${input.activeAsset.id} (${input.activeAsset.type}, ${input.activeAsset.mimeType})${input.activeAsset.storageKey ? `, storage=${input.activeAsset.storageKey}` : ''}` : 'Active asset: none';
    const attached = input.assets?.length ? `Attached media: ${input.assets.map(a => `${a.id} (${a.type}, ${a.mimeType})`).join(', ')}` : '';
    const contents: GeminiContent[] = history.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: `${message.role}: ${message.text}` }] }));

    if (this.storage) {
      const media = input.assets?.length ? input.assets : (input.activeAsset ? [input.activeAsset] : []);
      for (const asset of media) {
        if (!asset.storageKey) continue;
        const bytes = await this.storage.get(asset.storageKey);
        if (bytes.byteLength > MAX_INLINE_MEDIA_BYTES) continue;
        contents.push({ role: 'user', parts: [{ inlineData: { mimeType: asset.mimeType, data: Buffer.from(bytes).toString('base64') } }] });
      }
    }

    contents.push({ role: 'user', parts: [{ text: `${active}${attached}\n\nCurrent request:\n${input.userPrompt}` }] });
    return this.loop.run({
      systemPrompt: [
        'You are the production Telegram AI media assistant powered by Gemini 3.5 Flash.',
        'Understand natural-language requests and use registered tools when an operation must actually be performed.',
        'You can inspect attached multimodal media when supplied in conversation contents.',
        'Never claim a media operation completed unless a tool returned a successful result.',
        'Preserve user intent and use the active/attached media when relevant.',
        'Treat follow-up references such as "it", "this", "that image", and "the previous version" as references to persistent conversation context.',
        'After tools execute, inspect their results and provide the user-facing final answer.'
      ].join('\n'),
      userPrompt: input.userPrompt,
      contents,
      context,
      maxToolRounds: 5
    });
  }
}
