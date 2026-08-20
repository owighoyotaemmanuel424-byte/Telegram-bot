import { runFfmpeg } from '../media/ffmpeg.js';

export interface ExecutionRequest {
  operation: string;
  inputPath?: string;
  outputPath: string;
  options?: { start?: number; duration?: number; width?: number; height?: number; fps?: number; removeAudio?: boolean };
}

export class MediaExecutor {
  async execute(request: ExecutionRequest): Promise<{ outputPath: string }> {
    if (!request.inputPath) throw new Error('Media input is required for this operation');
    const options = request.options ?? {};
    const args: string[] = ['-i', request.inputPath];

    if (options.start !== undefined) args.push('-ss', String(options.start));
    if (options.duration !== undefined) args.push('-t', String(options.duration));
    if (request.operation === 'resize' && options.width && options.height) args.push('-vf', `scale=${options.width}:${options.height}`);
    if (request.operation === 'fps' && options.fps) args.push('-r', String(options.fps));
    if (options.removeAudio) args.push('-an');

    args.push('-y', request.outputPath);
    await runFfmpeg({ input: request.inputPath, output: request.outputPath, args });
    return { outputPath: request.outputPath };
  }
}
