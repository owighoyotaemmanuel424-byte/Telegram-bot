import { GeminiClient } from './client.js';
import { GEMINI_TOOLS } from './agent-tools.js';
import type { GeminiToolCall } from './agent.js';

export class LiveGeminiMediaAgent {
  constructor(private readonly client = new GeminiClient()) {}

  async run(input: { systemPrompt: string; userPrompt: string; assets?: Array<{ id: string; type: string; mimeType: string; fileUri?: string }> }): Promise<{ text: string; toolCalls: GeminiToolCall[] }> {
    const parts = [{ text: input.userPrompt }, ...(input.assets ?? []).map(asset => ({ fileData: asset.fileUri ? { mimeType: asset.mimeType, fileUri: asset.fileUri } : undefined, text: asset.fileUri ? undefined : `[asset ${asset.id} is available to the application]` }))];
    const response = await this.client.generateContent({ systemInstruction: input.systemPrompt, contents: [{ role: 'user', parts }], tools: [...GEMINI_TOOLS] });
    const responseParts = response.candidates?.[0]?.content?.parts ?? [];
    const toolCalls = responseParts.filter(part => part.functionCall).map(part => ({ name: part.functionCall!.name as GeminiToolCall['name'], arguments: part.functionCall!.args }));
    const text = responseParts.filter(part => part.text).map(part => part.text).join('\n').trim();
    return { text, toolCalls };
  }
}
