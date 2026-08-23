import { GeminiClient } from '../gemini/client.js';
import { VercelDeployer } from './deployer.js';

export type GeneratedFile = { path: string; content: string };
export type BuildResult = { projectName: string; slug: string; summary: string; files: GeneratedFile[]; branch: string; repositoryUrl: string; deployment?: { url: string; id: string; readyState: string } };

const MAX_FILES = 35;
const MAX_FILE_BYTES = 40_000;

function slugify(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'generated-app'; }
function extractJson(text: string): unknown { const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(); const candidate = fenced ?? text.trim(); const start = candidate.indexOf('{'); const end = candidate.lastIndexOf('}'); if (start < 0 || end <= start) throw new Error('AI returned an invalid project manifest.'); return JSON.parse(candidate.slice(start, end + 1)); }

export class AppBuilderService {
  constructor(private readonly gemini = new GeminiClient(), private readonly deployer?: VercelDeployer) {}

  async generate(prompt: string, owner: string, repo: string, token: string, deploy = false): Promise<BuildResult> {
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
    await this.publish(owner, repo, token, branch, slug, files, `feat: generate ${slug} from Telegram prompt`);
    let deployment: BuildResult['deployment'];
    if (deploy) {
      if (!this.deployer) throw new Error('Vercel deployment is not configured.');
      deployment = await this.deployer.waitForReady((await this.deployer.deployFromGitHub(owner, repo, branch, slug)).id);
    }
    return { projectName, slug, summary: typeof parsed.summary === 'string' ? parsed.summary : 'Generated application', files, branch, repositoryUrl: `https://github.com/${owner}/${repo}`, deployment };
  }

  private async github(token: string, path: string, init: RequestInit = {}): Promise<any> { const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) } }); const body = await response.text(); if (!response.ok) throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`); return body ? JSON.parse(body) : undefined; }
  private async publish(owner: string, repo: string, token: string, branch: string, slug: string, files: GeneratedFile[], message: string): Promise<void> { const base = await this.github(token, `/repos/${owner}/${repo}/git/ref/heads/main`); await this.github(token, `/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) }); for (const file of files) { const path = `generated/${slug}/${file.path}`; await this.github(token, `/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `${message}: ${file.path}`, content: Buffer.from(file.content, 'utf8').toString('base64'), branch }) }); } }
}
