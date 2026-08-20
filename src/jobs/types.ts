export type JobStatus = 'queued' | 'analyzing' | 'processing' | 'generating' | 'rendering' | 'uploading' | 'completed' | 'failed' | 'cancelled';

export interface MediaJob {
  id: string;
  userId: string;
  conversationId?: string;
  inputAssetIds: string[];
  prompt: string;
  status: JobStatus;
  progress: number;
  provider?: string;
  providerJobId?: string;
  creditsReserved: number;
  error?: string;
  outputAssetIds: string[];
  createdAt: string;
  updatedAt: string;
}
