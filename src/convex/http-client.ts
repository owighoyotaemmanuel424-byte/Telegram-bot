import { config } from '../config.js';

interface ConvexResponse { status?: string; value?: unknown; errorMessage?: string; }

export class ConvexHttpClient {
  constructor(private readonly url = config.CONVEX_URL, private readonly secret = process.env.AGENT_GATEWAY_SECRET) {
    if (!url) throw new Error('CONVEX_URL is not configured');
    if (!secret) throw new Error('AGENT_GATEWAY_SECRET is not configured');
  }

  async mutation(path: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.url!.replace(/\/$/, '')}/api/mutation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.secret}` },
      body: JSON.stringify({ path, args })
    });
    const body = await response.json() as ConvexResponse;
    if (!response.ok || body.status === 'error') throw new Error(body.errorMessage ?? `Convex mutation failed: ${response.status}`);
    return body.value;
  }

  async getOrCreateTelegramUser(input: { telegramId: string; username?: string; firstName?: string; lastName?: string }): Promise<string> {
    return String(await this.mutation('users:getOrCreateByTelegramId', input));
  }

  async createMediaAsset(input: { userId: string; telegramFileId: string; storageKey: string; type: 'image' | 'video' | 'audio' | 'document'; mimeType: string; conversationId?: string }): Promise<string> {
    return String(await this.mutation('mediaAssets:create', input));
  }
}
