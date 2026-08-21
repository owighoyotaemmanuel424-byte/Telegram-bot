import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

function authorized(request: Request) {
  const expected = process.env.AGENT_GATEWAY_SECRET;
  return Boolean(expected) && request.headers.get('x-agent-secret') === expected;
}

export const get = httpAction(async (ctx, request) => {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const keys = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'GEMINI_TEXT_MODEL', 'GEMINI_VISION_MODEL', 'GEMINI_FAST_MODEL'];
  const result: Record<string, string | undefined> = {};
  for (const key of keys) result[key] = (await ctx.runQuery(internal.providerSettings.getInternal, { key }))?.value;
  return Response.json(result);
});
