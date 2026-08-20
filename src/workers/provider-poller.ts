import type { MediaProvider, ProviderJob } from '../providers/types.js';

export interface ProviderPollResult { job: ProviderJob; attempts: number; }

export async function waitForProvider(provider: MediaProvider, providerJobId: string, options: { intervalMs?: number; maxAttempts?: number } = {}): Promise<ProviderPollResult> {
  const intervalMs = options.intervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 120;
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const job = await provider.getStatus(providerJobId);
    if (job.status === 'completed') return { job, attempts };
    if (job.status === 'failed') throw new Error(job.error ?? 'Media provider job failed');
    if (attempts < maxAttempts) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Media provider job timed out');
}
