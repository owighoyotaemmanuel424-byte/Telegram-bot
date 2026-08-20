import { GEMINI_TOOLS, type GeminiToolName } from './agent-tools.js';

export interface GeminiToolCall { name: GeminiToolName; arguments: Record<string, unknown>; }
export interface GeminiAgentResponse { text?: string; toolCalls: GeminiToolCall[]; }

export interface GeminiAgentClient {
  run(input: { systemPrompt: string; userPrompt: string; assets?: Array<{ id: string; type: string; mimeType: string; url?: string }>; }): Promise<GeminiAgentResponse>;
}

export class GeminiMediaAgent {
  constructor(private readonly client: GeminiAgentClient) {}

  async plan(input: Parameters<GeminiAgentClient['run']>[0]) {
    const response = await this.client.run({ ...input, systemPrompt: `${input.systemPrompt}\nYou are the media orchestration layer. Use tools for actions you can actually execute. Never claim a tool completed unless its result confirms completion. Available tools: ${GEMINI_TOOLS.map(tool => tool.name).join(', ')}.` });
    return response;
  }
}
