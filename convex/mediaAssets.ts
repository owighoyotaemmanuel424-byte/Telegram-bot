import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const assetType = v.union(v.literal('image'), v.literal('video'), v.literal('audio'), v.literal('document'));

export const create = mutation({
  args: { userId: v.id('users'), conversationId: v.optional(v.id('conversations')), storageId: v.optional(v.id('_storage')), storageKey: v.optional(v.string()), telegramFileId: v.optional(v.string()), type: assetType, mimeType: v.string(), parentAssetId: v.optional(v.id('mediaAssets')) },
  handler: async (ctx, args) => {
    const parent = args.parentAssetId ? await ctx.db.get(args.parentAssetId) : null;
    return await ctx.db.insert('mediaAssets', { ...args, version: (parent?.version ?? 0) + 1, createdAt: Date.now() });
  }
});

export const latest = query({ args: { conversationId: v.id('conversations'), type: assetType }, handler: async (ctx, { conversationId, type }) => {
  const assets = await ctx.db.query('mediaAssets').withIndex('by_conversation', q => q.eq('conversationId', conversationId)).order('desc').take(100);
  return assets.find(asset => asset.type === type) ?? null;
}});

export const listForConversation = query({ args: { conversationId: v.id('conversations') }, handler: async (ctx, { conversationId }) => ctx.db.query('mediaAssets').withIndex('by_conversation', q => q.eq('conversationId', conversationId)).order('desc').take(100) });
