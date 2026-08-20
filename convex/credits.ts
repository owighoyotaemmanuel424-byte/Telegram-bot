import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const refund = mutation({
  args: { userId: v.id('users'), amount: v.number(), reference: v.string() },
  handler: async (ctx, { userId, amount, reference }) => {
    if (amount <= 0) throw new Error('Refund amount must be positive');
    const duplicate = await ctx.db.query('creditTransactions').withIndex('by_reference', q => q.eq('reference', reference)).unique();
    if (duplicate) return false;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');
    const now = Date.now();
    await ctx.db.patch(userId, { credits: user.credits + amount, updatedAt: now });
    await ctx.db.insert('creditTransactions', { userId, amount, type: 'refund', reference, createdAt: now });
    return true;
  }
});

export const purchase = mutation({
  args: { userId: v.id('users'), amount: v.number(), reference: v.string() },
  handler: async (ctx, { userId, amount, reference }) => {
    if (amount <= 0) throw new Error('Purchase amount must be positive');
    const duplicate = await ctx.db.query('creditTransactions').withIndex('by_reference', q => q.eq('reference', reference)).unique();
    if (duplicate) return false;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');
    const now = Date.now();
    await ctx.db.patch(userId, { credits: user.credits + amount, updatedAt: now });
    await ctx.db.insert('creditTransactions', { userId, amount, type: 'purchase', reference, createdAt: now });
    return true;
  }
});
