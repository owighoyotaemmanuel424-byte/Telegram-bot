import { GeminiAgentLoop } from './agent-loop.js';
import { GeminiToolDispatcher, type ToolContext } from './tool-dispatcher.js';
import type { GeminiClient } from './client.js';

export interface TelegramAgentInput {
  userPrompt: string;
  assets?: Array<{ id: string; type: string; mimeType: string }>;
  userId: string;
  jobId?: string;
}

export class TelegramGeminiAgent {
  private readonly loop: GeminiAgentLoop;

  constructor(client: GeminiClient, dispatcher: GeminiToolDispatcher) {
    this.loop = new GeminiAgentLoop(client, dispatcher);
  }

  async run(input: TelegramAgentInput) {
    const context: ToolContext = { userId: input.userId, jobId: input.jobId };
    const assetSummary = input.assets?.length
      ? `\nAttached media:\n${input.assets.map(a => `- ${a.id} (${a.type}, ${a.mimeType})`).join('\n')}`
      : '';

    return this.loop.run({
      systemPrompt: [
        'You are the production Telegram AI media assistant powered by Gemini 3.5 Flash.',
        'Understand natural-language requests and use registered tools when an operation must actually be performed.',
        'Never claim a media operation completed unless a tool returned a successful result.',
        'Preserve user intent and use attached media when relevant.',
        'After tools execute, inspect their results and provide the user-facing final answer.'
      ].join('\n'),
      userPrompt: `${input.userPrompt}${assetSummary}`,
      context,
      maxToolRounds: 5
    });
  }
}
