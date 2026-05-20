// ============================================================================
// OpenSource CLI - Core Type Definitions
// The ultimate AI coding CLI agent
// ============================================================================

// ---- LLM Provider Types ----

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'together'
  | 'fireworks'
  | 'custom';

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  baseUrl?: string;
  models: ModelConfig[];
  defaultModel?: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
}

// ---- Message Types ----

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string | ContentBlock[];
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
  text?: string;
  toolUse?: ToolCall;
  toolResult?: ToolResult;
  thinking?: string;
  imageUrl?: string;
}

// ---- Tool Types ----

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: ToolHandler;
  category: ToolCategory;
  requiresApproval?: boolean;
  approvalRule?: (args: Record<string, unknown>) => boolean;
}

export type ToolCategory =
  | 'filesystem'
  | 'shell'
  | 'search'
  | 'web'
  | 'git'
  | 'browser'
  | 'mcp'
  | 'memory'
  | 'skill'
  | 'agent'
  | 'communication'
  | 'obsidian';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

export interface ToolContext {
  workdir: string;
  sessionId: string;
  agentId: string;
  signal?: AbortSignal;
}

// ---- Agent Types ----

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt?: string;
  model?: string;
  provider?: ProviderName;
  tools?: string[];
  workspace?: string;
  bindings?: string[];
  maxIterations?: number;
  autoApprove?: string[];
  memoryEnabled?: boolean;
  skillsEnabled?: boolean;
}

export interface AgentState {
  id: string;
  status: 'idle' | 'running' | 'planning' | 'executing' | 'waiting' | 'error' | 'completed';
  currentTask?: string;
  progress?: number;
  toolCalls: ToolCall[];
  messages: Message[];
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

// ---- Session Types ----

export interface SessionConfig {
  id: string;
  agentId: string;
  workdir: string;
  model: string;
  provider: ProviderName;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  tokenUsage: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
}

// ---- Memory Types ----

export interface MemoryLayer {
  name: string;
  description: string;
  load: (workdir: string) => Promise<string>;
  save: (workdir: string, content: string) => Promise<void>;
  maxSize?: number;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  content: string;
  embedding?: number[];
  timestamp: Date;
  tags: string[];
}

// ---- Skill Types ----

export interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  triggers: string[];
  instructions: string;
  tools?: string[];
  category?: string;
  tags?: string[];
}

export interface SkillInstance extends SkillDefinition {
  path: string;
  enabled: boolean;
  lastUsed?: Date;
  useCount: number;
}

// ---- Hook Types ----

export type HookType =
  | 'pre-tool-call'
  | 'post-tool-call'
  | 'pre-message'
  | 'post-message'
  | 'pre-plan'
  | 'post-plan'
  | 'session-start'
  | 'session-end'
  | 'error'
  | 'heartbeat';

export interface HookDefinition {
  type: HookType;
  name: string;
  handler: HookHandler;
  priority?: number;
  enabled?: boolean;
}

export type HookHandler = (context: HookContext) => Promise<HookResult>;

export interface HookContext {
  hookType: HookType;
  sessionId: string;
  agentId: string;
  data?: Record<string, unknown>;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  message?: Message;
}

export interface HookResult {
  allowed: boolean;
  modified?: Record<string, unknown>;
  message?: string;
}

// ---- Gateway Types ----

export interface GatewayConfig {
  port: number;
  host: string;
  agents: AgentConfig[];
  channels: ChannelConfig[];
  heartbeatInterval: number;
  maxConcurrentAgents: number;
}

export interface ChannelConfig {
  type: 'cli' | 'websocket' | 'telegram' | 'discord' | 'slack' | 'whatsapp';
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface GatewayState {
  running: boolean;
  startTime: Date;
  activeSessions: string[];
  agentStates: Map<string, AgentState>;
  channelConnections: Map<string, unknown>;
}

// ---- MCP Types ----

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'http';
  enabled?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  serverName: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverName: string;
}

// ---- Plan Types ----

export interface PlanStep {
  id: string;
  description: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  result?: string;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'rejected';
  createdAt: Date;
}

// ---- Config Types ----

export interface NexusConfig {
  // LLM
  provider: ProviderName;
  model: string;
  fallbackModels?: string[];

  // Memory
  memory: {
    enabled: boolean;
    layers: string[];
    maxEntries: number;
  };

  // Skills
  skills: {
    enabled: boolean;
    paths: string[];
    autoCreate: boolean;
  };

  // Tools
  tools: {
    allowed: string[];
    denied: string[];
    approvalRequired: string[];
  };

  // Hooks
  hooks: {
    enabled: boolean;
    paths: string[];
  };

  // MCP
  mcp: {
    enabled: boolean;
    servers: MCPServerConfig[];
  };

  // Agent
  agent: {
    maxIterations: number;
    planningMode: 'auto' | 'always' | 'never';
    autoApprove: string[];
    contextWindow: number;
  };

  // Obsidian Vault
  obsidian: {
    enabled: boolean;
    vaultPath: string;
    excludePatterns: string[];
    indexOnStart: boolean;
  };

  // Gateway
  gateway: {
    enabled: boolean;
    port: number;
    heartbeatInterval: number;
  };

  // TUI
  tui: {
    theme: 'dark' | 'light' | 'auto';
    showToolCalls: boolean;
    showThinking: boolean;
    compactMode: boolean;
    showWorkspaceTree?: boolean;
  };
}

// ---- Event Types ----

export type NexusEventType =
  | 'session:start'
  | 'session:end'
  | 'message:send'
  | 'message:receive'
  | 'tool:call'
  | 'tool:result'
  | 'tool:error'
  | 'plan:create'
  | 'plan:approve'
  | 'plan:execute'
  | 'plan:complete'
  | 'agent:spawn'
  | 'agent:complete'
  | 'agent:error'
  | 'memory:save'
  | 'memory:load'
  | 'skill:create'
  | 'skill:execute'
  | 'hook:trigger'
  | 'heartbeat'
  | 'error';

export interface NexusEvent {
  type: NexusEventType;
  timestamp: Date;
  sessionId?: string;
  agentId?: string;
  data?: Record<string, unknown>;
}

export type EventHandler = (event: NexusEvent) => void | Promise<void>;

// ---- Response Types ----

export interface LLMResponse {
  id: string;
  content: string;
  toolCalls: ToolCall[];
  thinking?: string;
  usage: TokenUsage;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

// ---- Plugin Types ----

export interface PluginDefinition {
  name: string;
  version: string;
  description: string;
  author?: string;
  activate: (context: PluginContext) => Promise<void>;
  deactivate: () => Promise<void>;
}

export interface PluginContext {
  registerTool: (tool: ToolDefinition) => void;
  registerHook: (hook: HookDefinition) => void;
  registerSkill: (skill: SkillDefinition) => void;
  registerCommand: (command: CommandDefinition) => void;
  config: NexusConfig;
  events: {
    on: (type: NexusEventType, handler: EventHandler) => void;
    emit: (event: NexusEvent) => void;
  };
}

export interface CommandDefinition {
  name: string;
  description: string;
  handler: (args: string[], context: CommandContext) => Promise<void>;
}

export interface CommandContext {
  sessionId: string;
  agentId: string;
  workdir: string;
}
