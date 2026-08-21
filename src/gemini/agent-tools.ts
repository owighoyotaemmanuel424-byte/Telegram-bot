export const GEMINI_TOOLS = [
  { name: 'generate_image', description: 'Generate an image from a natural-language prompt.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, aspect_ratio: { type: 'string' } }, required: ['prompt'] } },
  { name: 'edit_image', description: 'Edit an existing image according to the requested changes.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, asset_ids: { type: 'array', items: { type: 'string' } } }, required: ['prompt', 'asset_ids'] } },
  { name: 'generate_video', description: 'Generate video from text or image assets.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, asset_ids: { type: 'array', items: { type: 'string' } }, duration: { type: 'number' }, aspect_ratio: { type: 'string' } }, required: ['prompt'] } },
  { name: 'edit_video', description: 'Create a deterministic video editing plan.', parameters: { type: 'object', properties: { instructions: { type: 'string' }, asset_ids: { type: 'array', items: { type: 'string' } } }, required: ['instructions', 'asset_ids'] } },
  { name: 'transcribe_audio', description: 'Transcribe an audio or voice asset.', parameters: { type: 'object', properties: { asset_id: { type: 'string' }, language: { type: 'string' } }, required: ['asset_id'] } },
  { name: 'generate_voice', description: 'Generate speech or voice audio from text.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, voice: { type: 'string' }, language: { type: 'string' } }, required: ['prompt'] } },
  { name: 'analyze_document', description: 'Analyze or summarize a document asset.', parameters: { type: 'object', properties: { asset_id: { type: 'string' }, question: { type: 'string' } }, required: ['asset_id'] } },
  { name: 'convert_media', description: 'Convert or compress a supported media asset.', parameters: { type: 'object', properties: { asset_id: { type: 'string' }, target_format: { type: 'string' }, quality: { type: 'string' } }, required: ['asset_id', 'target_format'] } }
] as const;
export type GeminiToolName = typeof GEMINI_TOOLS[number]['name'];
