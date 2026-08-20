import { mutation } from './_generated/server';
import { v } from 'convex/values';

const statuses = v.union(v.literal('queued'), v.literal('analyzing'), v.literal('processing'), v.literal('generating'), v.literal('rendering'), v.literal('uploading'), v.literal('completed'), v.literal('failed'), v.literal('cancelled'));

export const progress = mutation({
  args: { jobId: v.id('jobs'), status: statuses, progress: v.number(), provider: v.optional(v.string()), providerJobId: v.optional(v.string()), error: v.optional(v.string()), outputUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.progress < 0 || args.progress > 100) throw new Error('Progress must be between 0 and 100');
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error('Job not found');
    await ctx.db.patch(args.jobId, { status: args.status, progress: args.progress, provider: args.provider ?? job.provider, providerJobId: args.providerJobId ?? job.providerJobId, error: args.error, outputUrl: args.outputUrl ?? job.outputUrl, updatedAt: Date.now() });
  }
});
