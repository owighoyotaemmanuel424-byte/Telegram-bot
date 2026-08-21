import type { MediaProvider, ProviderCapabilities, ProviderJob } from './types.js';
import type { MediaAsset } from '../gemini/types.js';

export class ConfiguredGenericProvider implements MediaProvider {
  constructor(readonly name: string, private readonly endpoint: string | undefined, private readonly apiKey: string | undefined, readonly capabilities: ProviderCapabilities) {}
  private assertConfigured() { if (!this.endpoint || !this.apiKey) throw new Error(`${this.name} endpoint and API key are required`); }
  private async request(path: string, init?: RequestInit): Promise<ProviderJob> {
    this.assertConfigured();
    const response = await fetch(`${this.endpoint!.replace(/\/$/, '')}${path}`, { ...init, headers: { authorization: `Bearer ${this.apiKey!}`, 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    const body = await response.json() as Partial<ProviderJob> & { id?: string; error?: string };
    if (!response.ok) throw new Error(body.error ?? `${this.name} error: ${response.status}`);
    return { providerJobId: body.providerJobId ?? body.id ?? '', status: body.status ?? 'queued', progress: body.progress, outputAssets: body.outputAssets, error: body.error };
  }
  create(input: { operation: string; prompt: string; assets: MediaAsset[]; options?: Record<string, unknown> }) { return this.request('', { method: 'POST', body: JSON.stringify(input) }); }
  getStatus(providerJobId: string) { return this.request(`/${encodeURIComponent(providerJobId)}`, { method: 'GET' }); }
}
