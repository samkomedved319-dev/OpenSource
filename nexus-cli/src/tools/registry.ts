// ============================================================================
// OpenSource CLI - Tool Registry
// Central registry for all tools (filesystem, shell, search, web, git, etc.)
// ============================================================================

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, NexusConfig } from '../types/index.js';
import type { MCPTool } from '../types/index.js';
import { registerFileTools } from './file.js';
import { registerShellTools } from './shell.js';
import { registerSearchTools } from './search.js';
import { registerWebTools } from './web.js';
import { registerGitTools } from './git.js';
import { registerBrowserTools } from './browser.js';
import { registerMemoryTools } from './memory.js';
import { registerSkillTools } from './skill.js';
import { registerAgentTools } from './agent.js';
import { registerObsidianTools } from './obsidian.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private config: NexusConfig;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async registerDefaults(): Promise<void> {
    // Filesystem tools
    registerFileTools(this);

    // Shell tools
    registerShellTools(this);

    // Search tools
    registerSearchTools(this);

    // Web tools
    registerWebTools(this);

    // Git tools
    registerGitTools(this);

    // Browser tools
    registerBrowserTools(this);

    // Memory tools
    registerMemoryTools(this);

    // Skill tools
    registerSkillTools(this);

    // Agent tools
    registerAgentTools(this);

    // Obsidian Vault tools (local-first knowledge base)
    if (this.config.obsidian?.enabled) {
      registerObsidianTools(this, this.config);
    }
  }

  register(tool: ToolDefinition): void {
    if (this.isToolDenied(tool.name)) {
      return;
    }
    this.tools.set(tool.name, tool);
  }

  registerMCPTools(mcpTools: MCPTool[]): void {
    for (const mcpTool of mcpTools) {
      this.register({
        name: `mcp_${mcpTool.name}`,
        description: `[MCP: ${mcpTool.serverName}] ${mcpTool.description}`,
        parameters: mcpTool.inputSchema as Record<string, unknown>,
        handler: async (args, context) => {
          // MCP tool execution handled by MCP manager
          return {
            toolCallId: args._toolCallId as string || '',
            content: 'MCP tool execution not yet implemented',
            isError: true,
          };
        },
        category: 'mcp',
        requiresApproval: true,
      });
    }
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.listTools().filter(t => this.isToolAllowed(t.name));
  }

  async executeTool(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        content: `Unknown tool: ${toolCall.name}`,
        isError: true,
      };
    }

    if (!this.isToolAllowed(toolCall.name)) {
      return {
        toolCallId: toolCall.id,
        content: `Tool "${toolCall.name}" is not allowed`,
        isError: true,
      };
    }

    try {
      return await tool.handler(toolCall.input, context);
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        content: `Tool "${toolCall.name}" error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private isToolAllowed(name: string): boolean {
    const allowed = this.config.tools.allowed;
    const denied = this.config.tools.denied;

    if (allowed.includes('*') && !denied.includes(name)) return true;
    if (denied.includes('*')) return false;
    if (denied.includes(name)) return false;
    if (allowed.includes(name)) return true;

    return allowed.includes('*');
  }

  private isToolDenied(name: string): boolean {
    return this.config.tools.denied.includes(name) ||
           this.config.tools.denied.includes('*');
  }
}
