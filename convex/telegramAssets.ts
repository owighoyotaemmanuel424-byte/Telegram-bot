import { mutation } from './_generated/server';
import { v } from 'convex/values';

const type = v.union(v.literal('image'), v.literal('video'), v.literal('audio'), v.literal('document'));

export const record = mutation({
  args: {
    userId: v.id('users'),
    conversationId: v.optional(v.id('conversations')),
    telegramFileId: v.string(),
    type,
    mimeType: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('mediaAssets').filter(q => q.eq(q.field('telegramFileId'), args.telegramFileId)).first();
    if (existing) return existing._id;
    return await ctx.db.insert('mediaAssets', { ...args, version: 1, createdAt: Date.now() });
  }
});
