import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const status = v.union(v.literal('queued'), v.literal('analyzing'), v.literal('processing'), v.literal('generating'), v.literal('rendering'), v.literal('uploading'), v.literal('completed'), v.literal('failed'), v.literal('cancelled'));

export const create = mutation({
  args: { userId: v.id('users'), conversationId: v.optional(v.id('conversations')), prompt: v.string(), intent: v.string(), creditsReserved: v.number(), reference: v.string() },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.creditsReserved) || args.creditsReserved <= 0) throw new Error('creditsReserved must be a positive integer');
    const duplicate = await ctx.db.query('creditTransactions').withIndex('by_reference', q => q.eq('reference', args.reference)).unique();
    if (duplicate) {
      const existing = await ctx.db.query('jobs').withIndex('by_user', q => q.eq('userId', args.userId)).order('desc').first();
      return existing?._id;
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');
    if (user.credits < args.creditsReserved) throw new Error('Insufficient credits');
    const now = Date.now();
    await ctx.db.patch(args.userId, { credits: user.credits - args.creditsReserved, updatedAt: now });
    await ctx.db.insert('creditTransactions', { userId: args.userId, amount: -args.creditsReserved, type: 'reserve', reference: args.reference, createdAt: now });
    return await ctx.db.insert('jobs', { userId: args.userId, conversationId: args.conversationId, prompt: args.prompt, intent: args.intent, creditsReserved: args.creditsReserved, status: 'queued', progress: 0, createdAt: now, updatedAt: now });
  }
});

export const claimNext = mutation({ args: {}, handler: async (ctx) => {
  const job = await ctx.db.query('jobs').withIndex('by_status', q => q.eq('status', 'queued')).order('asc').first();
  if (!job) return null;
  await ctx.db.patch(job._id, { status: 'processing', progress: 1, updatedAt: Date.now() });
  return { ...job, status: 'processing' as const, progress: 1 };
}});

export const updateStatus = mutation({
  args: { jobId: v.id('jobs'), status, progress: v.optional(v.number()), error: v.optional(v.string()), provider: v.optional(v.string()), providerJobId: v.optional(v.string()), outputUrl: v.optional(v.string()) },
  handler: async (ctx, { jobId, ...patch }) => { await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() }); }
});

export const failAndRefund = mutation({
  args: { jobId: v.id('jobs'), reason: v.string() },
  handler: async (ctx, { jobId, reason }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'failed' || job.status === 'cancelled') return false;
    const reference = `refund:${jobId}`;
    const duplicate = await ctx.db.query('creditTransactions').withIndex('by_reference', q => q.eq('reference', reference)).unique();
    if (!duplicate && job.creditsReserved > 0) {
      const user = await ctx.db.get(job.userId);
      if (!user) throw new Error('User not found');
      await ctx.db.patch(job.userId, { credits: user.credits + job.creditsReserved, updatedAt: Date.now() });
      await ctx.db.insert('creditTransactions', { userId: job.userId, amount: job.creditsReserved, type: 'refund', reference, createdAt: Date.now() });
    }
    await ctx.db.patch(jobId, { status: 'failed', error: reason, updatedAt: Date.now() });
    return true;
  }
});

export const get = query({ args: { jobId: v.id('jobs') }, handler: async (ctx, { jobId }) => ctx.db.get(jobId) });
export const listForUser = query({ args: { userId: v.id('users') }, handler: async (ctx, { userId }) => ctx.db.query('jobs').withIndex('by_user', q => q.eq('userId', userId)).order('desc').take(50) });
