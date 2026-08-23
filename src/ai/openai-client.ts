import type { AIProvider, AIProviderContent, AIProviderFunctionResult, AIProviderResponse } from './provider.js';

export class OpenAIClient implements AIProvider {
  constructor(private readonly apiKey: string, private readonly model = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini') {}

  private async request(body: Record<string, unknown>): Promise<AIProviderResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }> };
    const message = data.choices?.[0]?.message;
    const parts = [{ text: message?.content ?? '' }, ...(message?.tool_calls ?? []).map(call => ({ functionCall: { id: call.id, name: call.function.name, args: JSON.parse(call.function.arguments || '{}') } }))];
    return { candidates: [{ content: { role: 'model', parts } }] };
  }

  async generateContent(input: { systemInstruction?: string; contents: AIProviderContent[]; tools?: unknown[] }): Promise<AIProviderResponse> {
    const messages: Array<Record<string, unknown>> = [];
    if (input.systemInstruction) messages.push({ role: 'system', content: input.systemInstruction });
    for (const content of input.contents) {
      const text = content.parts.filter(part => part.text).map(part => part.text).join('\n');
      messages.push({ role: content.role === 'model' ? 'assistant' : 'user', content: text });
    }
    const body: Record<string, unknown> = { model: this.model, messages };
    if (input.tools?.length) body.tools = input.tools.map((tool: any) => ({ type: 'function', function: tool }));
    return this.request(body);
  }

  async continueWithFunctionResults(input: { systemInstruction?: string; contents: AIProviderContent[]; tools?: unknown[]; results: AIProviderFunctionResult[] }): Promise<AIProviderResponse> {
    const messages: Array<Record<string, unknown>> = [];
    if (input.systemInstruction) messages.push({ role: 'system', content: input.systemInstruction });
    for (const content of input.contents) {
      const text = content.parts.filter(part => part.text).map(part => part.text).join('\n');
      if (text) messages.push({ role: content.role === 'model' ? 'assistant' : 'user', content: text });
      for (const part of content.parts) if (part.functionCall) messages.push({ role: 'assistant', tool_calls: [{ id: part.functionCall.id, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } }] });
    }
    for (const result of input.results) messages.push({ role: 'tool', tool_call_id: result.id, content: JSON.stringify(result.response) });
    const body: Record<string, unknown> = { model: this.model, messages };
    if (input.tools?.length) body.tools = input.tools.map((tool: any) => ({ type: 'function', function: tool }));
    return this.request(body);
  }
}
