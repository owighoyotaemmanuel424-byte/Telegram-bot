import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const set = mutation({
  args: { key: v.string(), encryptedValue: v.optional(v.string()), value: v.optional(v.string()), updatedBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.encryptedValue && !args.value) throw new Error('A value is required');
    const existing = await ctx.db.query('providerSettings').withIndex('by_key', q => q.eq('key', args.key)).unique();
    const patch = { encryptedValue: args.encryptedValue, value: args.value, updatedAt: Date.now(), updatedBy: args.updatedBy };
    if (existing) { await ctx.db.patch(existing._id, patch); return existing._id; }
    return await ctx.db.insert('providerSettings', { key: args.key, ...patch });
  }
});

export const get = query({ args: { key: v.string() }, handler: async (ctx, { key }) => ctx.db.query('providerSettings').withIndex('by_key', q => q.eq('key', key)).unique() });

export const listPublic = query({ args: {}, handler: async ctx => {
  const rows = await ctx.db.query('providerSettings').collect();
  return rows.map(row => ({ key: row.key, configured: Boolean(row.encryptedValue || row.value), value: row.key.toLowerCase().includes('model') ? row.value : undefined, updatedAt: row.updatedAt }));
} });
