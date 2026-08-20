export interface ToolContext {
  userId: string;
  jobId?: string;
}

export interface ToolResult {
  success: boolean;
  message: string;
  outputAssetIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface AITool {
  name: string;
  description: string;
  execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, AITool>();

  register(tool: AITool): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  list(): AITool[] {
    return [...this.tools.values()];
  }
}
