import type { MediaAsset } from '../gemini/types.js';
import type { AITool, ToolContext, ToolResult } from '../tools/registry.js';

export interface WorkflowPlan {
  operation: string;
  steps: Array<{ tool: string; input: Record<string, unknown> }>;
  assets: MediaAsset[];
}

export class MediaWorkflowEngine {
  constructor(private readonly tools: Map<string, AITool>) {}

  async execute(plan: WorkflowPlan, context: ToolContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const step of plan.steps) {
      const tool = this.tools.get(step.tool);
      if (!tool) throw new Error(`Unknown workflow tool: ${step.tool}`);
      const result = await tool.execute(step.input, context);
      results.push(result);
      if (!result.success) break;
    }
    return results;
  }
}
