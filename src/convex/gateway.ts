export interface ConvexJobGateway {
  create(input: { userId: string; intent: string; prompt: string; creditsReserved: number; reference: string }): Promise<{ jobId: string }>;
  failAndRefund(jobId: string, reason: string): Promise<void>;
}

export class HttpConvexJobGateway implements ConvexJobGateway {
  constructor(private readonly baseUrl: string, private readonly secret: string) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-secret': this.secret },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Convex gateway error ${response.status}: ${text}`);
    return JSON.parse(text) as T;
  }

  async create(input: { userId: string; intent: string; prompt: string; creditsReserved: number; reference: string }) {
    return this.post<{ jobId: string }>('/agent/jobs/create', { telegramId: input.userId, intent: input.intent, prompt: input.prompt, creditsReserved: input.creditsReserved, reference: input.reference });
  }

  async failAndRefund(jobId: string, reason: string) {
    await this.post<{ ok: boolean }>('/agent/jobs/fail', { jobId, reason });
  }
}
