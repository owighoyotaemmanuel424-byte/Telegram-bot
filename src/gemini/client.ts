import type { AIProvider, AIProviderContent, AIProviderFunctionResult, AIProviderPart, AIProviderResponse } from '../ai/provider.js';

export type GeminiPart = AIProviderPart;
export type GeminiContent = AIProviderContent;
export type GeminiResponse = AIProviderResponse;
export type GeminiFunctionResult = AIProviderFunctionResult;

export class GeminiClient implements AIProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly model = process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.5-flash';

  private async request(body: Record<string, unknown>): Promise<GeminiResponse> {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY is required');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${text}`);
    return JSON.parse(text) as GeminiResponse;
  }

  async generateContent(input: { systemInstruction?: string; contents: GeminiContent[]; tools?: unknown[] }): Promise<GeminiResponse> {
    return this.request({ systemInstruction: input.systemInstruction ? { parts: [{ text: input.systemInstruction }] } : undefined, contents: input.contents, tools: input.tools ? [{ functionDeclarations: input.tools }] : undefined });
  }

  async continueWithFunctionResults(input: { systemInstruction?: string; contents: GeminiContent[]; tools?: unknown[]; results: GeminiFunctionResult[] }): Promise<GeminiResponse> {
    const functionResponseParts: GeminiPart[] = input.results.map(result => ({ functionResponse: { id: result.id, name: result.name, response: result.response } }));
    return this.generateContent({ systemInstruction: input.systemInstruction, tools: input.tools, contents: [...input.contents, { role: 'user', parts: functionResponseParts }] });
  }
}
