import type { JobGateway } from '../gemini/register-tools.js';

interface ConvexMutationResponse { status?: string; value?: unknown; errorMessage?: string; }

export class ConvexJobGateway implements JobGateway {
  constructor(private readonly convexUrl: string, private readonly secret: string) {}

  private async mutation(path: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.convexUrl.replace(/\/$/, '')}/api/mutation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.secret}` },
      body: JSON.stringify({ path, args })
    });
    const body = await response.json() as ConvexMutationResponse;
    if (!response.ok || body.status === 'error') throw new Error(body.errorMessage ?? `Convex mutation failed: ${response.status}`);
    return body.value;
  }

  async create(input: { userId: string; intent: string; prompt: string; creditsReserved: number; reference: string }): Promise<{ jobId: string }> {
    throw new Error('ConvexJobGateway.create requires a Telegram-aware server identity; use createForTelegram in the deployment adapter');
  }

  async createForTelegram(input: { telegramId: string; intent: string; prompt: string; creditsReserved: number; reference: string }): Promise<{ jobId: string }> {
    const value = await this.mutation('jobs:createForTelegram', input);
    return { jobId: String(value) };
  }

  async failAndRefund(jobId: string, reason: string): Promise<void> {
    await this.mutation('jobs:failAndRefund', { jobId, reason });
  }
}
