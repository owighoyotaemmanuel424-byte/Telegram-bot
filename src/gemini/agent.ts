import { GEMINI_TOOLS, type GeminiToolName } from './agent-tools.js';
import { GeminiClient, type GeminiContent, type GeminiResponse } from './client.js';
import { GeminiToolDispatcher } from './tool-dispatcher.js';

export interface GeminiToolCall { id?: string; name: GeminiToolName; arguments: Record<string, unknown> }
export interface GeminiAgentResponse { text?: string; toolCalls: GeminiToolCall[]; response: GeminiResponse }
export interface GeminiAgentInput { systemPrompt: string; userPrompt: string; assets?: Array<{ id: string; type: string; mimeType: string; url?: string }>; userId: string; jobId?: string; maxToolRounds?: number }

const orchestrationPrompt = `You are the media orchestration layer. Use tools for actions you can actually execute. Never claim a tool completed unless its result confirms completion. Ask only for information that is essential. Preserve user intent. Available tools: ${GEMINI_TOOLS.map(tool => tool.name).join(', ')}.`;

function extractCalls(response: GeminiResponse): GeminiToolCall[] {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.flatMap(part => part.functionCall ? [{ id: part.functionCall.id, name: part.functionCall.name as GeminiToolName, arguments: part.functionCall.args ?? {} }] : []);
}

function extractText(response: GeminiResponse): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map(part => part.text).filter((value): value is string => Boolean(value)).join('');
  return text || undefined;
}

export class GeminiMediaAgent {
  constructor(private readonly client: GeminiClient, private readonly dispatcher: GeminiToolDispatcher) {}

  async run(input: GeminiAgentInput): Promise<GeminiAgentResponse> {
    const maxRounds = Math.min(Math.max(input.maxToolRounds ?? 8, 1), 16);
    const systemPrompt = `${input.systemPrompt}\n${orchestrationPrompt}`;
    const assetContext = input.assets?.length ? `\nAvailable assets:\n${JSON.stringify(input.assets)}` : '';
    const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: `${input.userPrompt}${assetContext}` }] }];
    let response = await this.client.generateContent({ systemInstruction: systemPrompt, contents, tools: [...GEMINI_TOOLS] });
    const allCalls: GeminiToolCall[] = [];

    for (let round = 0; round < maxRounds; round++) {
      const calls = extractCalls(response);
      if (calls.length === 0) return { text: extractText(response), toolCalls: allCalls, response };
      allCalls.push(...calls);

      const results = await Promise.all(calls.map(async call => {
        try {
          const result = await this.dispatcher.execute(call, { userId: input.userId, jobId: input.jobId });
          return { id: call.id, name: call.name, response: { result, ok: true } };
        } catch (error) {
          return { id: call.id, name: call.name, response: { ok: false, error: error instanceof Error ? error.message : 'Tool execution failed' } };
        }
      }));

      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) throw new Error('Gemini returned tool calls without model content');
      contents.push(modelContent);
      response = await this.client.continueWithFunctionResults({ systemInstruction: systemPrompt, contents, tools: [...GEMINI_TOOLS], results });
    }

    throw new Error(`Gemini tool-call loop exceeded ${maxRounds} rounds`);
  }
}
