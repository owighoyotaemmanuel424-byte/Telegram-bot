export interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string }; fileData?: { mimeType: string; fileUri: string }; functionCall?: { name: string; args: Record<string, unknown> }; }
export interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }>; }

export class GeminiClient {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly model = process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.5-flash';

  async generateContent(input: { systemInstruction?: string; contents: Array<{ role?: 'user' | 'model'; parts: GeminiPart[] }>; tools?: unknown[] }): Promise<GeminiResponse> {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY is required');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: input.systemInstruction ? { parts: [{ text: input.systemInstruction }] } : undefined, contents: input.contents, tools: input.tools ? [{ functionDeclarations: input.tools }] : undefined }) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${text}`);
    return JSON.parse(text) as GeminiResponse;
  }
}
