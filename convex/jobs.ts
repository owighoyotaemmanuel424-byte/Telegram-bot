import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const status = v.union(v.literal('queued'), v.literal('analyzing'), v.literal('processing'), v.literal('generating'), v.literal('rendering'), v.literal('uploading'), v.literal('completed'), v.literal('failed'), v.literal('cancelled'));

export const create = mutation({
  args: { userId: v.id('users'), conversationId: v.optional(v.id('conversations')), prompt: v.string(), intent: v.string(), creditsReserved: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('jobs', { ...args, status: 'queued', progress: 0, createdAt: now, updatedAt: now });
  }
});

export const claimNext = mutation({
  args: {},
  handler: async (ctx) => {
    const job = await ctx.db.query('jobs').withIndex('by_status', q => q.eq('status', 'queued')).order('asc').first();
    if (!job) return null;
    await ctx.db.patch(job._id, { status: 'processing', progress: 1, updatedAt: Date.now() });
    return { ...job, status: 'processing' as const, progress: 1 };
  }
});

export const updateStatus = mutation({
  args: { jobId: v.id('jobs'), status, progress: v.optional(v.number()), error: v.optional(v.string()), provider: v.optional(v.string()), providerJobId: v.optional(v.string()) },
  handler: async (ctx, { jobId, ...patch }) => { await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() }); }
});

export const get = query({ args: { jobId: v.id('jobs') }, handler: async (ctx, { jobId }) => ctx.db.get(jobId) });
export const listForUser = query({ args: { userId: v.id('users') }, handler: async (ctx, { userId }) => ctx.db.query('jobs').withIndex('by_user', q => q.eq('userId', userId)).order('desc').take(50) });
