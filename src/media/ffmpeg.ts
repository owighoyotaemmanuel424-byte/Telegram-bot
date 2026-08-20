import { spawn } from 'node:child_process';

export interface FfmpegOperation {
  input: string;
  output: string;
  args: string[];
}

const ALLOWED_FLAGS = new Set(['-i', '-ss', '-to', '-t', '-vf', '-af', '-c:v', '-c:a', '-preset', '-crf', '-r', '-s', '-map', '-movflags', '-y', '-vn', '-an']);

export function validateFfmpegArgs(args: string[]): void {
  for (const arg of args) {
    if (arg.startsWith('-') && !ALLOWED_FLAGS.has(arg.split('=')[0] ?? arg)) throw new Error(`Unsupported FFmpeg flag: ${arg}`);
    if (/[;&|`$()<>]/.test(arg)) throw new Error('Unsafe FFmpeg argument');
  }
}

export async function runFfmpeg(operation: FfmpegOperation): Promise<void> {
  validateFfmpegArgs(operation.args);
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...operation.args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with code ${code}`)));
  });
}
