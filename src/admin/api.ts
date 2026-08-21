import { getProviderConfig, setProviderConfig } from './config-store.js';

export function adminConfigResponse() {
  return Response.json({ ok: true, config: getProviderConfig() });
}

export async function updateAdminConfig(request: Request) {
  if (request.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) return new Response('Unauthorized', { status: 401 });
  const body = await request.json() as { geminiApiKey?: string; telegramBotToken?: string; geminiTextModel?: string; geminiVisionModel?: string; geminiFastModel?: string };
  if (body.geminiApiKey && body.geminiApiKey.length < 10) return Response.json({ ok: false, error: 'Invalid Gemini API key' }, { status: 400 });
  if (body.telegramBotToken && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(body.telegramBotToken)) return Response.json({ ok: false, error: 'Invalid Telegram bot token' }, { status: 400 });
  setProviderConfig(body);
  return adminConfigResponse();
}
