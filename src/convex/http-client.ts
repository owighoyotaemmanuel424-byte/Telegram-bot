import { config } from '../config.js';

interface ConvexResponse { status?: string; value?: unknown; errorMessage?: string; }

export class ConvexHttpClient {
  constructor(private readonly url = config.CONVEX_URL, private readonly secret = process.env.AGENT_GATEWAY_SECRET) {
    if (!url) throw new Error('CONVEX_URL is not configured');
    if (!secret) throw new Error('AGENT_GATEWAY_SECRET is not configured');
  }

  private async request(method: 'mutation' | 'query', path: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.url!.replace(/\/$/, '')}/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.secret}` }, body: JSON.stringify({ path, args }) });
    const body = await response.json() as ConvexResponse;
    if (!response.ok || body.status === 'error') throw new Error(body.errorMessage ?? `Convex ${method} failed: ${response.status}`);
    return body.value;
  }

  async mutation(path: string, args: Record<string, unknown>): Promise<unknown> { return this.request('mutation', path, args); }
  async query(path: string, args: Record<string, unknown>): Promise<unknown> { return this.request('query', path, args); }
  async getOrCreateTelegramUser(input: { telegramId: string; username?: string; firstName?: string; lastName?: string }): Promise<string> { return String(await this.mutation('users:getOrCreateByTelegramId', input)); }
  async getOrCreateConversation(userId: string, title?: string): Promise<string> { return String(await this.mutation('conversations:getOrCreate', { userId, title })); }
  async getConversationContext(conversationId: string, userId: string): Promise<any> { return this.query('conversations:context', { conversationId, userId }); }
  async setActiveAsset(conversationId: string, userId: string, assetId: string): Promise<string> { return String(await this.mutation('conversations:setActiveAsset', { conversationId, userId, assetId })); }
  async addMessage(conversationId: string, userId: string, role: 'user' | 'assistant' | 'tool', text: string): Promise<string> { return String(await this.mutation('conversations:addMessage', { conversationId, userId, role, text })); }
  async createMediaAsset(input: { userId: string; telegramFileId: string; storageKey: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; conversationId?: string }): Promise<string> { return String(await this.mutation('mediaAssets:create', input)); }
}
