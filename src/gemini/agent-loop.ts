import type { GeminiClient, GeminiContent, GeminiResponse } from './client.js';
import { GEMINI_TOOLS } from './agent-tools.js';
import type { GeminiToolCall } from './agent.js';
import { GeminiToolDispatcher, type ToolContext } from './tool-dispatcher.js';

export interface AgentRunInput { systemPrompt: string; userPrompt: string; contents?: GeminiContent[]; context: ToolContext; maxToolRounds?: number; }

export interface AgentRunResult { response: GeminiResponse; toolResults: Array<{ name: string; response: Record<string, unknown> }>; rounds: number; }

function extractCalls(response: GeminiResponse): GeminiToolCall[] {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.filter(part => part.functionCall?.name).map(part => ({
    name: part.functionCall!.name as GeminiToolCall['name'],
    arguments: part.functionCall!.args ?? {}
  }));
}

export class GeminiAgentLoop {
  constructor(private readonly client: GeminiClient, private readonly dispatcher: GeminiToolDispatcher) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const maxRounds = input.maxToolRounds ?? 5;
    let contents: GeminiContent[] = input.contents?.length ? [...input.contents] : [{ role: 'user', parts: [{ text: input.userPrompt }] }];
    let response = await this.client.generateContent({ systemInstruction: input.systemPrompt, contents, tools: GEMINI_TOOLS as unknown as unknown[] });
    const toolResults: Array<{ name: string; response: Record<string, unknown> }> = [];

    for (let round = 1; round <= maxRounds; round++) {
      const calls = extractCalls(response);
      if (!calls.length) return { response, toolResults, rounds: round };

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);

      const results = [];
      for (const call of calls) {
        try {
          const result = await this.dispatcher.execute(call, input.context);
          const normalized = result && typeof result === 'object' ? result as Record<string, unknown> : { result };
          results.push({ name: call.name, response: normalized });
          toolResults.push({ name: call.name, response: normalized });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          const failure = { error: message };
          results.push({ name: call.name, response: failure });
          toolResults.push({ name: call.name, response: failure });
        }
      }

      response = await this.client.continueWithFunctionResults({ systemInstruction: input.systemPrompt, contents, tools: GEMINI_TOOLS as unknown as unknown[], results });
    }

    throw new Error(`Gemini tool loop exceeded ${maxRounds} rounds`);
  }
}
