import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const assetType = v.union(v.literal('image'), v.literal('video'), v.literal('audio'), v.literal('document'));

export const create = mutation({
  args: { userId: v.id('users'), conversationId: v.optional(v.id('conversations')), storageId: v.optional(v.id('_storage')), telegramFileId: v.optional(v.string()), type: assetType, mimeType: v.string(), parentAssetId: v.optional(v.id('mediaAssets')) },
  handler: async (ctx, args) => {
    const parent = args.parentAssetId ? await ctx.db.get(args.parentAssetId) : null;
    return await ctx.db.insert('mediaAssets', { ...args, version: (parent?.version ?? 0) + 1, createdAt: Date.now() });
  }
});

export const listForConversation = query({ args: { conversationId: v.id('conversations') }, handler: async (ctx, { conversationId }) => ctx.db.query('mediaAssets').withIndex('by_conversation', q => q.eq('conversationId', conversationId)).order('desc').take(100) });
