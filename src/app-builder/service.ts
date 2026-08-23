import { GeminiClient } from '../gemini/client.js';
import { VercelDeployer } from './deployer.js';

export type GeneratedFile = { path: string; content: string };
export type BuildResult = { projectName: string; slug: string; summary: string; files: GeneratedFile[]; branch: string; repositoryUrl: string; deployment?: { url: string; id: string; readyState: string } };

const MAX_FILES = 35;
const MAX_FILE_BYTES = 40_000;
const MAX_REPAIR_ATTEMPTS = 2;

function slugify(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'generated-app'; }
function extractJson(text: string): unknown { const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(); const candidate = fenced ?? text.trim(); const start = candidate.indexOf('{'); const end = candidate.lastIndexOf('}'); if (start < 0 || end <= start) throw new Error('AI returned an invalid project manifest.'); return JSON.parse(candidate.slice(start, end + 1)); }

export class AppBuilderService {
  constructor(private readonly gemini = new GeminiClient(), private readonly deployer?: VercelDeployer) {}

  async generate(prompt: string, owner: string, repo: string, token: string): Promise<BuildResult> {
    const response = await this.gemini.generateContent({ systemInstruction: `You are a senior full-stack engineer generating a small, runnable web application from a Telegram user's request. Return ONLY valid JSON with this shape: {"projectName":"...","summary":"...","files":[{"path":"...","content":"..."}]}. Use Vite + React + TypeScript + plain CSS unless the request clearly needs another stack. The generated project must be self-contained, runnable with npm install && npm run build, and must not contain secrets. Keep it MVP-sized: at most ${MAX_FILES} files and each file under ${MAX_FILE_BYTES} bytes. Include package.json, index.html, src/main.tsx and required source files. Do not use markdown fences.`, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = response.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
    const parsed = extractJson(text) as { projectName?: unknown; summary?: unknown; files?: unknown };
    if (!Array.isArray(parsed.files)) throw new Error('AI did not return project files.');
    const files = parsed.files.filter((file): file is { path: string; content: string } => Boolean(file && typeof file === 'object' && typeof (file as any).path === 'string' && typeof (file as any).content === 'string')).slice(0, MAX_FILES).map(file => ({ path: file.path.replace(/^\/+/, '').replace(/\.\.(\/|\\)/g, ''), content: file.content })).filter(file => file.path && !file.path.startsWith('.env') && Buffer.byteLength(file.content, 'utf8') <= MAX_FILE_BYTES);
    if (!files.some(file => file.path === 'package.json')) throw new Error('Generated project is missing package.json.');
    if (!files.some(file => file.path === 'src/main.tsx')) throw new Error('Generated project is missing src/main.tsx.');
    const projectName = typeof parsed.projectName === 'string' ? parsed.projectName : 'Telegram Generated App';
    const slug = slugify(projectName);
    const branch = `generated/${slug}-${Date.now().toString(36)}`;
    const workflow: GeneratedFile = { path: '.github/workflows/generated-build.yml', content: this.buildWorkflow() };
    await this.publish(owner, repo, token, branch, slug, [...files, workflow], `feat: generate ${slug} from Telegram prompt`);
    await this.verifyAndRepair(owner, repo, token, branch, slug);
    return { projectName, slug, summary: typeof parsed.summary === 'string' ? parsed.summary : 'Generated application', files, branch, repositoryUrl: `https://github.com/${owner}/${repo}` };
  }

  async deployExistingBranch(owner: string, repo: string, branch: string, projectName: string): Promise<NonNullable<BuildResult['deployment']>> {
    if (!this.deployer) throw new Error('Vercel deployment is not configured.');
    const slug = slugify(projectName);
    const created = await this.deployer.deployFromGitHub(owner, repo, branch, slug, `generated/${slug}`);
    return this.deployer.waitForReady(created.id);
  }

  private buildWorkflow(): string { return `name: Generated App Build\n\non:\n  push:\n    paths:\n      - 'generated/**'\n  workflow_dispatch:\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - name: Locate generated project\n        id: project\n        shell: bash\n        run: |\n          path=$(find generated -mindepth 2 -maxdepth 2 -name package.json -print -quit)\n          test -n \"$path\"\n          echo \"path=$(dirname \"$path\")\" >> \"$GITHUB_OUTPUT\"\n      - name: Install dependencies\n        working-directory: ${{ steps.project.outputs.path }}\n        run: npm install --no-audit --no-fund\n      - name: Build\n        working-directory: ${{ steps.project.outputs.path }}\n        run: npm run build\n`; }

  private async verifyAndRepair(owner: string, repo: string, token: string, branch: string, slug: string): Promise<void> {
    let lastError = '';
    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
      const run = await this.waitForBuild(owner, repo, token, branch, attempt === 0);
      if (run.conclusion === 'success') return;
      lastError = await this.getRunLogs(owner, repo, token, run.id);
      if (attempt === MAX_REPAIR_ATTEMPTS) break;
      const repaired = await this.repairFiles(lastError, slug);
      if (!repaired.length) break;
      await this.updateFiles(owner, repo, token, branch, slug, repaired, `fix: AI repair generated app attempt ${attempt + 1}`);
    }
    throw new Error(`Generated app failed its build after ${MAX_REPAIR_ATTEMPTS} repair attempts. ${lastError.slice(-1800)}`);
  }

  private async repairFiles(errorLog: string, slug: string): Promise<GeneratedFile[]> {
    const response = await this.gemini.generateContent({ systemInstruction: `You repair a generated Vite React TypeScript app. Given a build log, return ONLY JSON: {"files":[{"path":"relative/path","content":"complete replacement file"}]}. Only return files that must change. Never return .env files, secrets, or paths outside the project. The project directory is generated/${slug}.`, contents: [{ role: 'user', parts: [{ text: errorLog.slice(-12000) }] }] });
    const text = response.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
    const parsed = extractJson(text) as { files?: unknown };
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files.filter((file): file is GeneratedFile => Boolean(file && typeof file === 'object' && typeof (file as any).path === 'string' && typeof (file as any).content === 'string')).slice(0, 10).map(file => ({ path: file.path.replace(/^\/+/, '').replace(/\.\.(\/|\\)/g, ''), content: file.content })).filter(file => file.path && !file.path.startsWith('.env') && Buffer.byteLength(file.content, 'utf8') <= MAX_FILE_BYTES);
  }

  private async waitForBuild(owner: string, repo: string, token: string, branch: string, waitForNew: boolean): Promise<{ id: number; conclusion: string | null }> {
    const deadline = Date.now() + 6 * 60_000;
    let baseline = 0;
    if (waitForNew) { const runs = await this.github(token, `/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`); baseline = Math.max(0, ...(runs.workflow_runs ?? []).map((r: any) => Number(r.id) || 0)); }
    while (Date.now() < deadline) {
      const runs = await this.github(token, `/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`);
      const candidate = (runs.workflow_runs ?? []).filter((r: any) => r.name === 'Generated App Build' && Number(r.id) > baseline).sort((a: any, b: any) => Number(b.id) - Number(a.id))[0];
      if (candidate) { if (candidate.status === 'completed') return { id: Number(candidate.id), conclusion: candidate.conclusion }; }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    throw new Error('Timed out waiting for generated app build validation.');
  }

  private async getRunLogs(owner: string, repo: string, token: string, runId: number): Promise<string> {
    const jobs = await this.github(token, `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`);
    const logs: string[] = [];
    for (const job of jobs.jobs ?? []) { try { logs.push(await this.githubText(token, `/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`)); } catch { logs.push(`Job ${job.name} failed without readable logs.`); } }
    return logs.join('\n').slice(-16000);
  }

  private async github(token: string, path: string, init: RequestInit = {}): Promise<any> { const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) } }); const body = await response.text(); if (!response.ok) throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`); return body ? JSON.parse(body) : undefined; }
  private async githubText(token: string, path: string): Promise<string> { const response = await fetch(`https://api.github.com${path}`, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } }); const body = await response.text(); if (!response.ok) throw new Error(`GitHub logs ${response.status}: ${body.slice(0, 500)}`); return body; }
  private async publish(owner: string, repo: string, token: string, branch: string, slug: string, files: GeneratedFile[], message: string): Promise<void> { const base = await this.github(token, `/repos/${owner}/${repo}/git/ref/heads/main`); await this.github(token, `/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) }); for (const file of files) { const path = `generated/${slug}/${file.path}`; await this.github(token, `/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `${message}: ${file.path}`, content: Buffer.from(file.content, 'utf8').toString('base64'), branch }) }); } }
  private async updateFiles(owner: string, repo: string, token: string, branch: string, slug: string, files: GeneratedFile[], message: string): Promise<void> { for (const file of files) { const path = `generated/${slug}/${file.path}`; const existing = await this.github(token, `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`); await this.github(token, `/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `${message}: ${file.path}`, content: Buffer.from(file.content, 'utf8').toString('base64'), sha: existing.sha, branch }) }); } }
}
