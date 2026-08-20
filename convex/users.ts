import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getOrCreateByTelegramId = mutation({
  args: { telegramId: v.string(), username: v.optional(v.string()), firstName: v.optional(v.string()), lastName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('users').withIndex('by_telegramId', q => q.eq('telegramId', args.telegramId)).unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { username: args.username, firstName: args.firstName, lastName: args.lastName, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('users', { ...args, plan: 'free', credits: 0, createdAt: now, updatedAt: now });
  }
});

export const getByTelegramId = query({ args: { telegramId: v.string() }, handler: async (ctx, { telegramId }) => ctx.db.query('users').withIndex('by_telegramId', q => q.eq('telegramId', telegramId)).unique() });

export const reserveCredits = mutation({
  args: { userId: v.id('users'), amount: v.number(), reference: v.string() },
  handler: async (ctx, { userId, amount, reference }) => {
    if (amount <= 0) throw new Error('Credit amount must be positive');
    const user = await ctx.db.get(userId);
    if (!user || user.credits < amount) throw new Error('Insufficient credits');
    const duplicate = await ctx.db.query('creditTransactions').withIndex('by_reference', q => q.eq('reference', reference)).unique();
    if (duplicate) return false;
    await ctx.db.patch(userId, { credits: user.credits - amount, updatedAt: Date.now() });
    await ctx.db.insert('creditTransactions', { userId, amount: -amount, type: 'reserve', reference, createdAt: Date.now() });
    return true;
  }
});
