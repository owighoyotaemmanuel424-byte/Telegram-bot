import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: { userId: v.id('users'), conversationId: v.optional(v.id('conversations')), prompt: v.string(), intent: v.string(), creditsReserved: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('jobs', { ...args, status: 'queued', progress: 0, createdAt: now, updatedAt: now });
  }
});

export const updateStatus = mutation({
  args: { jobId: v.id('jobs'), status: v.union(v.literal('queued'), v.literal('analyzing'), v.literal('processing'), v.literal('generating'), v.literal('rendering'), v.literal('uploading'), v.literal('completed'), v.literal('failed'), v.literal('cancelled')), progress: v.optional(v.number()), error: v.optional(v.string()) },
  handler: async (ctx, { jobId, ...patch }) => { await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() }); }
});

export const get = query({ args: { jobId: v.id('jobs') }, handler: async (ctx, { jobId }) => ctx.db.get(jobId) });
export const listForUser = query({ args: { userId: v.id('users') }, handler: async (ctx, { userId }) => ctx.db.query('jobs').withIndex('by_user', q => q.eq('userId', userId)).order('desc').take(50) });
