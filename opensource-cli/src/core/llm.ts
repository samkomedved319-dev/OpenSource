// ============================================================================
// OpenSource CLI — LLM Provider
// LOCAL-FIRST: Ollama by default. Streaming. Auto model-detection.
// Cloud APIs (Anthropic, OpenAI, etc.) are optional.
// ============================================================================

import OpenAI from 'openai';
import type { Message, LLMResponse, ToolDefinition, ToolCall, TokenUsage } from '../types/index.js';
import type { AgentConfig, NexusConfig, ProviderName } from '../types/index.js';

export interface LLMOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  stream?: boolean;
  onToken?: (token: string) => void;
  onThinkingToken?: (token: string) => void;
}

const PROVIDER_BASE_URLS: Record<ProviderName, string | undefined> = {
  anthropic:  'https://api.anthropic.com/v1',
  openai:     undefined,
  google:     'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama:     'http://localhost:11434/v1',
  groq:       'https://api.groq.com/openai/v1',
  deepseek:   'https://api.deepseek.com/v1',
  mistral:    'https://api.mistral.ai/v1',
  together:   'https://api.together.xyz/v1',
  fireworks:  'https://api.fireworks.ai/inference/v1',
  custom:     process.env.OPENSOURCE_CUSTOM_API_URL,
};

const PROVIDER_API_KEYS: Record<ProviderName, string | undefined> = {
  anthropic:  'ANTHROPIC_API_KEY',
  openai:     'OPENAI_API_KEY',
  google:     'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  ollama:     undefined,
  groq:       'GROQ_API_KEY',
  deepseek:   'DEEPSEEK_API_KEY',
  mistral:    'MISTRAL_API_KEY',
  together:   'TOGETHER_API_KEY',
  fireworks:  'FIREWORKS_API_KEY',
  custom:     'OPENSOURCE_CUSTOM_API_KEY',
};

// Preferred model order when auto-detecting from Ollama
const PREFERRED_MODELS = [
  'qwen2.5-coder:32b',
  'qwen2.5-coder:14b',
  'deepseek-r1:32b',
  'deepseek-r1:14b',
  'deepseek-r1:8b',
  'llama3.3:70b',
  'llama3.2:latest',
  'llama3.2',
  'mistral:latest',
  'qwen2.5-coder:7b',
  'gemma3:27b',
  'gemma3:12b',
];

export class LLMProvider {
  private agentConfig: AgentConfig;
  private globalConfig: NexusConfig;
  private clients = new Map<string, OpenAI>();
  private activeProvider: ProviderName | null = null;

  constructor(agentConfig: AgentConfig, globalConfig: NexusConfig) {
    this.agentConfig = agentConfig;
    this.globalConfig = globalConfig;
  }

  // ── Client Management ─────────────────────────────────────────────────────

  private getOrCreateClient(provider: ProviderName): OpenAI {
    const existing = this.clients.get(provider);
    if (existing) return existing;

    const apiKey = provider === 'ollama'
      ? 'ollama'
      : (process.env[PROVIDER_API_KEYS[provider]!] || '');
    const baseURL = PROVIDER_BASE_URLS[provider];

    const client = new OpenAI({ apiKey, baseURL });
    this.clients.set(provider, client);
    return client;
  }

  getActiveProvider(): ProviderName | null { return this.activeProvider; }

  // ── Auto-detect best available Ollama model ───────────────────────────────

  async detectBestModel(): Promise<string | null> {
    try {
      const available = await this.getAvailableOllamaModels();
      if (available.length === 0) return null;

      // Return first preferred model that's available
      for (const preferred of PREFERRED_MODELS) {
        const match = available.find(a => a === preferred || a.startsWith(preferred.split(':')[0]));
        if (match) return match;
      }

      return available[0];
    } catch {
      return null;
    }
  }

  async getAvailableOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { models?: Array<{ name: string }> };
      return (data.models || []).map(m => m.name);
    } catch {
      return [];
    }
  }

  resolveModelAlias(modelName: string, availableModels: string[]): string {
    const normalized = modelName.toLowerCase().replace(/[-_]/g, ' ');
    
    if (normalized.includes('source flash')) {
      // Map to fastest available small model
      const fastCandidates = ['llama3.2:latest', 'llama3.2', 'gemma2:2b', 'qwen2.5-coder:1.5b'];
      for (const c of fastCandidates) {
        if (availableModels.includes(c)) return c;
        const base = c.split(':')[0];
        const match = availableModels.find(a => a.startsWith(base));
        if (match) return match;
      }
      return availableModels[0] || 'llama3.2';
    }
    
    if (normalized.includes('source pro')) {
      // Map to standard robust coder/general model
      const proCandidates = ['samkomedved319/mythos:latest', 'mythos:latest', 'llama3:latest', 'llama3.2:latest', 'llama3.2', 'qwen2.5-coder:7b'];
      for (const c of proCandidates) {
        if (availableModels.includes(c)) return c;
        const base = c.split(':')[0];
        const match = availableModels.find(a => a.startsWith(base));
        if (match) return match;
      }
      return availableModels[0] || 'llama3.2';
    }
    
    if (normalized.includes('source ultra')) {
      // Map to best reasoning/coding model
      const ultraCandidates = ['qwen2.5-coder:14b', 'qwen2.5-coder:32b', 'samkomedved319/mythos:latest', 'mythos:latest', 'llama3:latest', 'deepseek-r1:14b', 'deepseek-r1:8b'];
      for (const c of ultraCandidates) {
        if (availableModels.includes(c)) return c;
        const base = c.split(':')[0];
        const match = availableModels.find(a => a.startsWith(base));
        if (match) return match;
      }
      return availableModels[0] || 'llama3.2';
    }
    
    return modelName;
  }

  // ── Main Chat Method ──────────────────────────────────────────────────────

  async chat(messages: Message[], options: LLMOptions = {}): Promise<LLMResponse> {
    const provider = (this.agentConfig.provider || this.globalConfig.provider) as ProviderName;
    let model      = this.agentConfig.model || this.globalConfig.model;

    // Resolve custom model aliases
    if (provider === 'ollama') {
      const available = await this.getAvailableOllamaModels();
      model = this.resolveModelAlias(model, available);
    }

    let client: OpenAI;
    try {
      client = this.getOrCreateClient(provider);
      this.activeProvider = provider;
    } catch {
      throw new Error(this.buildConnectionError(provider));
    }

    let finalMessages = [...messages];
    let finalTools = options.tools ? this.formatTools(options.tools) : undefined;

    if (provider === 'ollama' && options.tools && options.tools.length > 0) {
      const toolDescriptions = options.tools.map(t => {
        return `- **${t.name}**: ${t.description}\n  Parameters JSON Schema:\n${JSON.stringify(t.parameters, null, 2)}`;
      }).join('\n\n');

      const ollamaToolInstructions = `\n\n## Tool Calling Instructions
You have access to a set of local tools that you can call to perform actions or read information.
To call a tool, you MUST output a single XML block in the following exact format:
<tool_call>
{
  "name": "tool_name",
  "input": {
    "key": "value"
  }
}
</tool_call>

Rules:
1. You can only call ONE tool at a time.
2. Do NOT output any other text or tool calls after the </tool_call> tag.
3. If you want to reply with normal conversational text, just write standard text WITHOUT any <tool_call> tags.
4. Verify that the JSON inside <tool_call> is valid and matches the parameter schema.

Available Tools:
${toolDescriptions}`;

      // Append to the system message if it exists, otherwise prepend a new system message
      const systemMsgIdx = finalMessages.findIndex(m => m.role === 'system');
      if (systemMsgIdx !== -1) {
        finalMessages[systemMsgIdx] = {
          ...finalMessages[systemMsgIdx],
          content: finalMessages[systemMsgIdx].content + ollamaToolInstructions
        };
      } else {
        finalMessages.unshift({
          id: `sys-${Date.now()}`,
          role: 'system',
          content: ollamaToolInstructions,
          timestamp: new Date()
        });
      }

      // Bypass native OpenAI tools parameter for Ollama to prevent hanging and JSON schema leaking
      finalTools = undefined;

      // Convert tool role messages to user role messages for Ollama.
      // Without the native tools parameter, Ollama models don't understand
      // the 'tool' role. Converting to user messages with clear framing
      // preserves the tool result context naturally.
      finalMessages = finalMessages.map(msg => {
        if (msg.role === 'tool') {
          const toolName = msg.toolName || 'unknown';
          const resultContent = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
          return {
            ...msg,
            role: 'user' as const,
            content: `[Tool Result for "${toolName}"]:\n${resultContent}`,
          };
        }
        return msg;
      });
    }

    const formattedMessages = this.formatMessages(finalMessages);
    const tools = finalTools;

    // Use streaming if a token callback is provided and no tools (tools require non-streaming)
    const canStream = !!options.onToken && (!tools || tools.length === 0);

    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (canStream && options.onToken) {
          return await this.chatStreaming(client, model, formattedMessages, tools, options, provider);
        } else {
          return await this.chatBlocking(client, model, formattedMessages, tools, options, provider);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const errMsg = lastError.message.toLowerCase();
        if (
          options.signal?.aborted ||
          errMsg.includes('401') ||
          errMsg.includes('unauthorized') ||
          errMsg.includes('api key') ||
          errMsg.includes('invalid')
        ) {
          throw lastError;
        }

        // Try fallback models
        if (attempt === 0 && this.globalConfig.fallbackModels?.length) {
          for (const fallback of this.globalConfig.fallbackModels) {
            if (fallback === model) continue;
            try {
              return await this.chatBlocking(client, fallback, formattedMessages, tools, options, provider);
            } catch { continue; }
          }
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error('LLM call failed after retries');
  }

  // ── Streaming Path ────────────────────────────────────────────────────────

  private async chatStreaming(
    client: OpenAI,
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
    options: LLMOptions,
    provider: ProviderName,
  ): Promise<LLMResponse> {
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        tools,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8192,
        stream: true,
      },
      { signal: options.signal }
    );

    let fullContent = '';
    let fullThinking = '';
    let isThinking = false;
    const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 1. Explicit reasoning_content (Ollama/DeepSeek API reasoning property)
      const reasoning = (delta as unknown as { reasoning_content?: string })?.reasoning_content;
      if (reasoning) {
        fullThinking += reasoning;
        options.onThinkingToken?.(reasoning);
        continue;
      }

      // 2. Standard content streaming
      if (delta.content) {
        let chunkText = delta.content;

        // Check for `<think>` tag introduction
        if (chunkText.includes('<think>')) {
          isThinking = true;
          const parts = chunkText.split('<think>');
          if (parts[0]) {
            fullContent += parts[0];
            options.onToken?.(parts[0]);
          }
          if (parts[1]) {
            fullThinking += parts[1];
            options.onThinkingToken?.(parts[1]);
          }
          continue;
        }

        // Check for `</think>` tag closing
        if (chunkText.includes('</think>')) {
          isThinking = false;
          const parts = chunkText.split('</think>');
          if (parts[0]) {
            fullThinking += parts[0];
            options.onThinkingToken?.(parts[0]);
          }
          if (parts[1]) {
            fullContent += parts[1];
            options.onToken?.(parts[1]);
          }
          continue;
        }

        // Handle active state
        if (isThinking) {
          fullThinking += chunkText;
          options.onThinkingToken?.(chunkText);
        } else {
          fullContent += chunkText;
          options.onToken?.(chunkText);
        }
      }

      // Tool call delta accumulation
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallsMap.has(idx)) {
            toolCallsMap.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
          }
          const existing = toolCallsMap.get(idx)!;
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
        }
      }
    }

    const toolCalls: ToolCall[] = [];
    for (const [, tc] of toolCallsMap) {
      try {
        toolCalls.push({ id: tc.id, name: tc.name, input: JSON.parse(tc.args || '{}') });
      } catch { /* skip malformed */ }
    }

    let cleanedContent = fullContent;
    const finalToolCalls = [...toolCalls];

    if (provider === 'ollama' && cleanedContent.includes('<tool_call>')) {
      const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
      let match;
      while ((match = toolCallRegex.exec(cleanedContent)) !== null) {
        const jsonStr = match[1].trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            finalToolCalls.push({
              id: `call-${Math.random().toString(36).slice(2, 10)}`,
              name: parsed.name,
              input: parsed.input || parsed.arguments || {},
            });
          }
        } catch (e) {
          console.warn("Failed to parse tool call JSON from streamed text:", jsonStr, e);
        }
      }
      cleanedContent = cleanedContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
    }

    return {
      id: `stream-${Date.now()}`,
      content: cleanedContent,
      toolCalls: finalToolCalls,
      thinking: fullThinking.trim() || undefined,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
      stopReason: finalToolCalls.length > 0 ? 'tool_use' : 'end_turn',
    };
  }

  // ── Blocking Path ─────────────────────────────────────────────────────────

  private async chatBlocking(
    client: OpenAI,
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
    options: LLMOptions,
    provider: ProviderName,
  ): Promise<LLMResponse> {
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        tools,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8192,
      },
      { signal: options.signal }
    );

    return this.parseResponse(response, provider);
  }

  // ── Message / Tool Formatting ─────────────────────────────────────────────

  private formatMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          tool_call_id: msg.toolCallId || '',
        };
      }
      if (msg.role === 'system') {
        return {
          role: 'system' as const,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }
      if (msg.role === 'assistant') {
        return {
          role: 'assistant' as const,
          content: typeof msg.content === 'string' ? msg.content : null,
        };
      }
      return {
        role: 'user' as const,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      };
    });
  }

  private formatTools(tools: ToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  private extractThinking(content: string, reasoningContent?: string): { content: string; thinking?: string } {
    if (reasoningContent) {
      return { content, thinking: reasoningContent };
    }

    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const thinking = thinkMatch[1].trim();
      const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return { content: cleanedContent, thinking };
    }

    return { content };
  }

  private parseResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    provider: ProviderName,
  ): LLMResponse {
    const choice  = response.choices[0];
    const message = choice.message;

    let toolCalls: ToolCall[] = (message.tool_calls || []).map(tc => ({
      id:    tc.id,
      name:  tc.function.name,
      input: JSON.parse(tc.function.arguments || '{}'),
    }));

    const usage: TokenUsage = {
      inputTokens:      response.usage?.prompt_tokens     ?? 0,
      outputTokens:     response.usage?.completion_tokens ?? 0,
      cacheReadTokens:  0,
      cacheWriteTokens: 0,
      totalCost:        0,
    };

    // Support thinking output extraction
    const reasoningContent = (message as unknown as { reasoning_content?: string }).reasoning_content;
    let { content: cleanedContent, thinking } = this.extractThinking(message.content || '', reasoningContent);

    // If provider is ollama, parse text-based tool calls
    if (provider === 'ollama' && cleanedContent.includes('<tool_call>')) {
      const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
      let match;
      while ((match = toolCallRegex.exec(cleanedContent)) !== null) {
        const jsonStr = match[1].trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            toolCalls.push({
              id: `call-${Math.random().toString(36).slice(2, 10)}`,
              name: parsed.name,
              input: parsed.input || parsed.arguments || {},
            });
          }
        } catch (e) {
          console.warn("Failed to parse tool call JSON from text:", jsonStr, e);
        }
      }
      // Remove <tool_call> blocks from cleanedContent
      cleanedContent = cleanedContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
    }

    return {
      id:         response.id,
      content:    cleanedContent,
      toolCalls,
      thinking:   thinking,
      usage,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 
                  choice.finish_reason === 'length'      ? 'max_tokens' : 'end_turn',
    };
  }

  async countTokens(messages: Message[]): Promise<number> {
    return Math.ceil(
      messages.reduce((sum, m) => {
        const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return sum + c.length;
      }, 0) / 4
    );
  }

  // ── Error Messages ────────────────────────────────────────────────────────

  private buildConnectionError(provider: ProviderName): string {
    if (provider === 'ollama') {
      return [
        'Ollama is not reachable.',
        '  1. Install: https://ollama.com',
        '  2. Start:   ollama serve',
        '  3. Pull:    ollama pull llama3.2',
        '  4. Verify:  curl http://localhost:11434/api/tags',
      ].join('\n');
    }
    const key = PROVIDER_API_KEYS[provider];
    return [
      `Provider "${provider}" not configured.`,
      key ? `  Set env var: ${key}` : '  No API key env var defined.',
      `  Or use local: opensource -p ollama`,
    ].join('\n');
  }
}
