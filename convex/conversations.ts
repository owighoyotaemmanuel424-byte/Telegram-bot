import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getOrCreate = mutation({
  args: { userId: v.id('users'), title: v.optional(v.string()) },
  handler: async (ctx, { userId, title }) => {
    const existing = await ctx.db.query('conversations').withIndex('by_user', q => q.eq('userId', userId)).order('desc').first();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert('conversations', { userId, title, createdAt: now, updatedAt: now });
  }
});

export const setActiveAsset = mutation({
  args: { conversationId: v.id('conversations'), userId: v.id('users'), assetId: v.id('mediaAssets') },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    const asset = await ctx.db.get(args.assetId);
    if (!conversation || conversation.userId !== args.userId) throw new Error('Conversation access denied');
    if (!asset || asset.userId !== args.userId || asset.conversationId !== args.conversationId) throw new Error('Asset access denied');
    await ctx.db.patch(args.conversationId, { activeAssetId: args.assetId, updatedAt: Date.now() });
    return args.assetId;
  }
});

export const addMessage = mutation({
  args: { conversationId: v.id('conversations'), userId: v.id('users'), role: v.union(v.literal('user'), v.literal('assistant'), v.literal('tool')), text: v.string() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== args.userId) throw new Error('Conversation access denied');
    const id = await ctx.db.insert('messages', { ...args, createdAt: Date.now() });
    await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });
    return id;
  }
});

export const recentMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => ctx.db.query('messages').withIndex('by_conversation', q => q.eq('conversationId', conversationId)).order('desc').take(30)
});
