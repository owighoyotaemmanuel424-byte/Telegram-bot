export type DeploymentResult = { id: string; url: string; readyState: string };

export class VercelDeployer {
  constructor(private readonly token: string, private readonly teamId?: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`https://api.vercel.com${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Vercel API ${response.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : undefined;
  }

  async deployFromGitHub(owner: string, repo: string, ref: string, name: string): Promise<DeploymentResult> {
    const query = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : '';
    const deployment = await this.request(`/v13/deployments${query}`, {
      method: 'POST',
      body: JSON.stringify({ name: name.slice(0, 52), target: 'production', gitSource: { type: 'github', repo, ref, org: owner } })
    });
    return { id: deployment.id, url: deployment.url ? `https://${deployment.url}` : '', readyState: deployment.readyState ?? deployment.status ?? 'QUEUED' };
  }

  async waitForReady(id: string, timeoutMs = 10 * 60_000): Promise<DeploymentResult> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const deployment = await this.request(`/v13/deployments/${encodeURIComponent(id)}`);
      const state = deployment.readyState ?? deployment.status;
      if (state === 'READY') return { id: deployment.id, url: deployment.url ? `https://${deployment.url}` : '', readyState: state };
      if (['ERROR', 'CANCELED'].includes(state)) throw new Error(`Vercel deployment ${state.toLowerCase()}.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Vercel deployment timed out.');
  }
}
