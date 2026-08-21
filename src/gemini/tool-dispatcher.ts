import type { GeminiToolCall } from './agent.js';
import type { GeminiToolName } from './agent-tools.js';
import type { MediaAsset } from './types.js';

export interface ToolContext { userId: string; jobId?: string; requestId?: string; chatId?: string; statusMessageId?: number; conversationId?: string; assets?: MediaAsset[]; }
export type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;

export class GeminiToolDispatcher {
  private readonly handlers = new Map<GeminiToolName, ToolHandler>();
  register(name: GeminiToolName, handler: ToolHandler) { this.handlers.set(name, handler); }
  async execute(call: GeminiToolCall, context: ToolContext) {
    const handler = this.handlers.get(call.name);
    if (!handler) throw new Error(`No handler registered for Gemini tool: ${call.name}`);
    return handler(call.arguments, context);
  }
}
