// ============================================================================
// OpenSource CLI - MCP Server Manager
// Model Context Protocol integration for external tool servers
// ============================================================================

import type { MCPServerConfig, MCPTool, MCPResource, NexusConfig } from '../types/index.js';

export class MCPServerManager {
  private config: NexusConfig;
  private servers: Map<string, unknown> = new Map();

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    for (const serverConfig of this.config.mcp.servers) {
      if (serverConfig.enabled === false) continue;
      await this.startServer(serverConfig);
    }
  }

  private async startServer(config: MCPServerConfig): Promise<void> {
    try {
      // MCP server integration via stdio transport
      // In a full implementation, this would use @modelcontextprotocol/sdk
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...config.env } as Record<string, string>,
      });

      const client = new Client(
        { name: 'nexus-cli', version: '1.0.0' },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.servers.set(config.name, client);
    } catch (error) {
      console.error(`Failed to start MCP server "${config.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async discoverTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    for (const [name, server] of this.servers.entries()) {
      try {
        const client = server as { request: (params: unknown) => Promise<{ tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }> };
        const result = await client.request({ method: 'tools/list' });

        for (const tool of result.tools) {
          tools.push({
            name: tool.name,
            description: tool.description,
            serverName: name,
            inputSchema: tool.inputSchema,
          });
        }
      } catch {
        // Skip servers that fail to list tools
      }
    }

    return tools;
  }

  async discoverResources(): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    for (const [name, server] of this.servers.entries()) {
      try {
        const client = server as { request: (params: unknown) => Promise<{ resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }> }> };
        const result = await client.request({ method: 'resources/list' });

        for (const resource of result.resources) {
          resources.push({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
            serverName: name,
          });
        }
      } catch {
        // Skip servers that fail to list resources
      }
    }

    return resources;
  }

  async executeTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found`);
    }

    try {
      const client = server as { request: (params: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> };
      const result = await client.request({
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      });

      return result.content.map(c => c.text || '').join('\n');
    } catch (error) {
      throw new Error(`MCP tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stopAll(): Promise<void> {
    for (const [name, server] of this.servers.entries()) {
      try {
        const client = server as { close: () => Promise<void> };
        await client.close();
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.servers.clear();
  }
}
