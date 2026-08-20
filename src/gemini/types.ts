export type Intent =
  | 'chat'
  | 'image_generation'
  | 'image_edit'
  | 'image_to_video'
  | 'text_to_video'
  | 'video_edit'
  | 'video_conversion'
  | 'video_upscale'
  | 'audio_generation'
  | 'audio_edit'
  | 'transcription'
  | 'translation'
  | 'document_analysis'
  | 'ocr'
  | 'summarization'
  | 'content_creation'
  | 'social_media'
  | 'file_conversion'
  | 'general_utility';

export interface TaskPlan {
  intent: Intent;
  inputType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'mixed';
  operation: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  style?: string;
  needsAudio?: boolean;
  tools: string[];
  requiresConfirmation: boolean;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  uri?: string;
  telegramFileId?: string;
}
