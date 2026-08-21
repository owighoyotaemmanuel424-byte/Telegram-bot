import { GeminiAgentLoop } from './agent-loop.js';
import { GeminiToolDispatcher, type ToolContext } from './tool-dispatcher.js';
import type { GeminiClient } from './client.js';

export interface TelegramAgentInput {
  userPrompt: string;
  assets?: Array<{ id: string; type: string; mimeType: string; storageKey?: string }>;
  userId: string;
  jobId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'tool'; text: string }>;
  activeAsset?: { id: string; type: string; mimeType: string; storageKey?: string } | null;
}

export class TelegramGeminiAgent {
  private readonly loop: GeminiAgentLoop;
  constructor(client: GeminiClient, dispatcher: GeminiToolDispatcher) { this.loop = new GeminiAgentLoop(client, dispatcher); }

  async run(input: TelegramAgentInput) {
    const context: ToolContext = { userId: input.userId, jobId: input.jobId };
    const history = input.conversationHistory?.slice(-20).map(m => `${m.role}: ${m.text}`).join('\n') || '(no previous messages)';
    const active = input.activeAsset ? `Active asset: ${input.activeAsset.id} (${input.activeAsset.type}, ${input.activeAsset.mimeType})${input.activeAsset.storageKey ? `, storage=${input.activeAsset.storageKey}` : ''}` : 'Active asset: none';
    const attached = input.assets?.length ? `\nAttached media:\n${input.assets.map(a => `- ${a.id} (${a.type}, ${a.mimeType})${a.storageKey ? `, storage=${a.storageKey}` : ''}`).join('\n')}` : '';

    return this.loop.run({
      systemPrompt: [
        'You are the production Telegram AI media assistant powered by Gemini 3.5 Flash.',
        'Understand natural-language requests and use registered tools when an operation must actually be performed.',
        'Never claim a media operation completed unless a tool returned a successful result.',
        'Preserve user intent and use the active/attached media when relevant.',
        'Treat follow-up references such as "it", "this", "that image", and "the previous version" as references to the persistent conversation context.',
        'After tools execute, inspect their results and provide the user-facing final answer.'
      ].join('\n'),
      userPrompt: `Conversation history:\n${history}\n\n${active}${attached}\n\nCurrent request:\n${input.userPrompt}`,
      context,
      maxToolRounds: 5
    });
  }
}
