export interface AIProviderPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType: string; fileUri: string };
  functionCall?: { id?: string; name: string; args: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
}

export interface AIProviderContent {
  role?: 'user' | 'model';
  parts: AIProviderPart[];
}

export interface AIProviderResponse {
  candidates?: Array<{ content?: AIProviderContent }>;
}

export interface AIProviderFunctionResult {
  id?: string;
  name: string;
  response: Record<string, unknown>;
}

export interface AIProvider {
  generateContent(input: { systemInstruction?: string; contents: AIProviderContent[]; tools?: unknown[] }): Promise<AIProviderResponse>;
  continueWithFunctionResults(input: { systemInstruction?: string; contents: AIProviderContent[]; tools?: unknown[]; results: AIProviderFunctionResult[] }): Promise<AIProviderResponse>;
}
