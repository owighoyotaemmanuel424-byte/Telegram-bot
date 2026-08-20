import { query } from './_generated/server';

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const [users, jobs, assets, transactions] = await Promise.all([
      ctx.db.query('users').take(1000),
      ctx.db.query('jobs').take(1000),
      ctx.db.query('mediaAssets').take(1000),
      ctx.db.query('creditTransactions').take(1000)
    ]);
    return {
      users: users.length,
      jobs: jobs.length,
      assets: assets.length,
      transactions: transactions.length,
      activeJobs: jobs.filter(j => !['completed', 'failed', 'cancelled'].includes(j.status)).length,
      failedJobs: jobs.filter(j => j.status === 'failed').length
    };
  }
});
