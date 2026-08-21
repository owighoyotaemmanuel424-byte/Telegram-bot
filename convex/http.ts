import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();
function authorized(request: Request) { const expected = process.env.AGENT_GATEWAY_SECRET; return Boolean(expected) && request.headers.get('x-agent-secret') === expected; }

http.route({ path: '/telegram/webhook', method: 'POST', handler: httpAction(async (_ctx, request) => { const secret = request.headers.get('x-telegram-bot-api-secret-token'); if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 }); return new Response('ok', { status: 200 }); }) });

http.route({ path: '/agent/jobs/create', method: 'POST', handler: httpAction(async (ctx, request) => { if (!authorized(request)) return new Response('Unauthorized', { status: 401 }); const body = await request.json(); const jobId = await ctx.runMutation(internal.jobs.createForTelegram, body as any); return Response.json({ jobId }); }) });
http.route({ path: '/agent/jobs/claim', method: 'POST', handler: httpAction(async (ctx, request) => { if (!authorized(request)) return new Response('Unauthorized', { status: 401 }); const job = await ctx.runMutation(internal.jobs.claimNext, {}); if (!job) return Response.json({ job: null }); const assets = job.sourceAssetIds?.length ? await ctx.runQuery(internal.mediaAssets.byIds, { ids: job.sourceAssetIds as any }) : []; return Response.json({ job, assets }); }) });
http.route({ path: '/agent/jobs/status', method: 'POST', handler: httpAction(async (ctx, request) => { if (!authorized(request)) return new Response('Unauthorized', { status: 401 }); const body = await request.json(); await ctx.runMutation(internal.jobs.updateStatus, body as any); return Response.json({ ok: true }); }) });
http.route({ path: '/agent/jobs/fail', method: 'POST', handler: httpAction(async (ctx, request) => { if (!authorized(request)) return new Response('Unauthorized', { status: 401 }); const body = await request.json(); await ctx.runMutation(internal.jobs.failAndRefundInternal, body as any); return Response.json({ ok: true }); }) });

export default http;
