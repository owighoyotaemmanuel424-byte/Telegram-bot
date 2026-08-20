import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

export const recordMessage = internalMutation({
  args: {
    telegramId: v.string(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    text: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('users').withIndex('by_telegramId', q => q.eq('telegramId', args.telegramId)).unique();
    const now = Date.now();
    const userId = existing
      ? existing._id
      : await ctx.db.insert('users', { telegramId: args.telegramId, username: args.username, firstName: args.firstName, lastName: args.lastName, plan: 'free', credits: 0, createdAt: now, updatedAt: now });

    if (existing) await ctx.db.patch(existing._id, { username: args.username, firstName: args.firstName, lastName: args.lastName, updatedAt: now });

    let conversation = await ctx.db.query('conversations').withIndex('by_user', q => q.eq('userId', userId)).order('desc').first();
    if (!conversation) {
      const conversationId = await ctx.db.insert('conversations', { userId, title: 'Telegram conversation', createdAt: now, updatedAt: now });
      conversation = await ctx.db.get(conversationId);
    }
    if (!conversation) throw new Error('Unable to create conversation');
    await ctx.db.insert('messages', { conversationId: conversation._id, userId, role: 'user', text: args.text, createdAt: now });
    await ctx.db.patch(conversation._id, { updatedAt: now });
    return { userId, conversationId: conversation._id };
  }
});
