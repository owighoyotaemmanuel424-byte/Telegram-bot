import type { MediaJob } from './types.js';

export interface JobQueue {
  enqueue(job: MediaJob): Promise<void>;
  start(handler: (job: MediaJob) => Promise<void>): Promise<void>;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly queue: MediaJob[] = [];
  private running = false;

  async enqueue(job: MediaJob): Promise<void> { this.queue.push(job); }

  async start(handler: (job: MediaJob) => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const job = this.queue.shift();
      if (!job) continue;
      try { await handler(job); } catch (error) { console.error('Job failed', job.id, error); }
    }
    this.running = false;
  }
}
