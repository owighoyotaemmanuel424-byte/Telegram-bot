import { getRuntimeSecrets } from '../admin/config-store.js';
import { GeminiClient } from '../gemini/client.js';
import { OpenAIClient } from './openai-client.js';
import type { AIProvider } from './provider.js';

export function getAIProvider(): AIProvider {
  const runtime = getRuntimeSecrets();
  if (runtime.provider === 'openai') {
    const key = runtime.openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI is selected but OPENAI_API_KEY is not configured. Set it in Admin → AI Providers.');
    return new OpenAIClient(key, process.env.OPENAI_MODEL);
  }
  const key = runtime.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini is selected but GEMINI_API_KEY is not configured. Set it in Admin → AI Providers.');
  return new GeminiClient();
}
