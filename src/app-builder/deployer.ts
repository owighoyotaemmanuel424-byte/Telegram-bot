export type DeploymentResult = { id: string; url: string; readyState: string; projectId?: string };

export class VercelDeployer {
  constructor(private readonly token: string, private readonly teamId?: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`https://api.vercel.com${path}`, { ...init, headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`Vercel API ${response.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : undefined;
  }

  async deployFromGitHub(owner: string, repo: string, ref: string, name: string, rootDirectory?: string): Promise<DeploymentResult> {
    const query = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : '';
    const deployment = await this.request(`/v13/deployments${query}`, { method: 'POST', body: JSON.stringify({ name: name.slice(0, 52), target: 'production', gitSource: { type: 'github', repo, ref, org: owner }, projectSettings: rootDirectory ? { rootDirectory } : undefined }) });
    return { id: deployment.id, url: deployment.url ? `https://${deployment.url}` : '', readyState: deployment.readyState ?? deployment.status ?? 'QUEUED', projectId: deployment.projectId };
  }

  async waitForReady(id: string, timeoutMs = 10 * 60_000): Promise<DeploymentResult> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const deployment = await this.request(`/v13/deployments/${encodeURIComponent(id)}`);
      const state = deployment.readyState ?? deployment.status;
      if (state === 'READY') return { id: deployment.id, url: deployment.url ? `https://${deployment.url}` : '', readyState: state, projectId: deployment.projectId };
      if (['ERROR', 'CANCELED'].includes(state)) throw new Error(`Vercel deployment ${state.toLowerCase()}.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Vercel deployment timed out.');
  }

  async healthCheck(url: string, attempts = 5): Promise<{ ok: boolean; status: number; finalUrl: string }> {
    let lastStatus = 0;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'Telegram-AI-App-Builder/1.0' } }); lastStatus = response.status; if (response.ok) return { ok: true, status: response.status, finalUrl: response.url }; } catch {}
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return { ok: false, status: lastStatus, finalUrl: url };
  }

  async setProductionEnv(projectIdOrName: string, values: Record<string, string>): Promise<void> {
    const query = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : '';
    const body = Object.entries(values).map(([key, value]) => ({ key, value, type: 'sensitive', target: ['production'] }));
    await this.request(`/v10/projects/${encodeURIComponent(projectIdOrName)}/env${query}`, { method: 'POST', body: JSON.stringify(body) });
  }

  async listProductionDeployments(projectName: string): Promise<Array<{ id: string; url: string; createdAt?: number; state?: string }>> {
    const query = new URLSearchParams({ projectId: projectName, target: 'production', limit: '20' });
    if (this.teamId) query.set('teamId', this.teamId);
    const result = await this.request(`/v6/deployments?${query.toString()}`);
    return (result.deployments ?? []).map((item: any) => ({ id: String(item.uid ?? item.id), url: item.url ? `https://${item.url}` : '', createdAt: item.createdAt, state: item.readyState ?? item.state }));
  }

  async rollback(projectIdOrName: string, deploymentId: string): Promise<void> {
    const query = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : '';
    await this.request(`/v1/projects/${encodeURIComponent(projectIdOrName)}/rollback/${encodeURIComponent(deploymentId)}${query}`, { method: 'POST', body: JSON.stringify({}) });
  }
}
