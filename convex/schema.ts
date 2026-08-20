import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const jobStatus = v.union(v.literal('queued'), v.literal('analyzing'), v.literal('processing'), v.literal('generating'), v.literal('rendering'), v.literal('uploading'), v.literal('completed'), v.literal('failed'), v.literal('cancelled'));

export default defineSchema({
  users: defineTable({
    telegramId: v.string(), username: v.optional(v.string()), firstName: v.optional(v.string()), lastName: v.optional(v.string()), plan: v.string(), credits: v.number(), createdAt: v.number(), updatedAt: v.number()
  }).index('by_telegramId', ['telegramId']),
  conversations: defineTable({ userId: v.id('users'), title: v.optional(v.string()), activeAssetId: v.optional(v.id('mediaAssets')), createdAt: v.number(), updatedAt: v.number() }).index('by_user', ['userId']),
  messages: defineTable({ conversationId: v.id('conversations'), userId: v.id('users'), role: v.union(v.literal('user'), v.literal('assistant'), v.literal('tool')), text: v.string(), createdAt: v.number() }).index('by_conversation', ['conversationId']),
  mediaAssets: defineTable({ userId: v.id('users'), conversationId: v.optional(v.id('conversations')), storageId: v.optional(v.id('_storage')), telegramFileId: v.optional(v.string()), type: v.union(v.literal('image'), v.literal('video'), v.literal('audio'), v.literal('document')), mimeType: v.string(), version: v.number(), parentAssetId: v.optional(v.id('mediaAssets')), createdAt: v.number() }).index('by_user', ['userId']).index('by_conversation', ['conversationId']),
  jobs: defineTable({ userId: v.id('users'), conversationId: v.optional(v.id('conversations')), status: jobStatus, prompt: v.string(), intent: v.string(), provider: v.optional(v.string()), providerJobId: v.optional(v.string()), progress: v.number(), creditsReserved: v.number(), error: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() }).index('by_user', ['userId']).index('by_status', ['status']),
  jobSteps: defineTable({ jobId: v.id('jobs'), name: v.string(), status: jobStatus, progress: v.number(), metadata: v.optional(v.any()), createdAt: v.number(), updatedAt: v.number() }).index('by_job', ['jobId']),
  usage: defineTable({ userId: v.id('users'), operation: v.string(), credits: v.number(), provider: v.optional(v.string()), createdAt: v.number() }).index('by_user', ['userId']),
  creditTransactions: defineTable({ userId: v.id('users'), amount: v.number(), type: v.union(v.literal('reserve'), v.literal('charge'), v.literal('refund'), v.literal('purchase'), v.literal('adjustment')), reference: v.string(), createdAt: v.number() }).index('by_user', ['userId']).index('by_reference', ['reference']),
  webhookEvents: defineTable({ eventId: v.string(), source: v.string(), processedAt: v.number() }).index('by_eventId', ['eventId']),
  auditLogs: defineTable({ userId: v.optional(v.id('users')), action: v.string(), metadata: v.optional(v.any()), createdAt: v.number() }).index('by_user', ['userId'])
});
