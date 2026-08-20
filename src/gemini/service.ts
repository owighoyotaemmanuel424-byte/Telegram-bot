import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import type { MediaAsset, TaskPlan } from './types.js';

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string' },
    inputType: { type: 'string' },
    operation: { type: 'string' },
    prompt: { type: 'string' },
    duration: { type: 'number' },
    aspectRatio: { type: 'string' },
    style: { type: 'string' },
    needsAudio: { type: 'boolean' },
    tools: { type: 'array', items: { type: 'string' } },
    requiresConfirmation: { type: 'boolean' }
  },
  required: ['intent', 'inputType', 'operation', 'prompt', 'tools', 'requiresConfirmation']
} as const;

export class GeminiService {
  private readonly ai: GoogleGenAI;

  constructor(apiKey = config.GEMINI_API_KEY) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    this.ai = new GoogleGenAI({ apiKey });
  }

  async plan(text: string, assets: MediaAsset[] = []): Promise<TaskPlan> {
    const assetContext = assets.map((asset) => `${asset.type}:${asset.mimeType}`).join(', ') || 'none';
    const prompt = `You are the orchestration brain of a Telegram AI media assistant. Analyze the user's request and available media, then return ONLY valid JSON matching the supplied schema. Choose the minimum necessary tools, preserve user intent, infer reasonable defaults, and ask for confirmation only when an irreversible or unusually expensive action requires it. Available media: ${assetContext}. User request: ${text}`;

    const response = await this.ai.models.generateContent({
      model: config.GEMINI_FAST_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: PLAN_SCHEMA
      }
    });

    if (!response.text) throw new Error('Gemini returned an empty plan');
    return JSON.parse(response.text) as TaskPlan;
  }

  async chat(text: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: config.GEMINI_TEXT_MODEL,
      contents: text
    });
    return response.text ?? 'I could not generate a response.';
  }
}
