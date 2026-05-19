// ============================================================================
// OpenSource CLI - Memory Tools
// Save/load memory entries, search past conversations
// ============================================================================

import type { ToolRegistry } from './registry.js';
import type { MemorySystem } from '../memory/index.js';

// Reference to memory system - will be set during initialization
let memorySystemRef: MemorySystem | null = null;

export function setMemorySystemRef(ms: MemorySystem): void {
  memorySystemRef = ms;
}

export function registerMemoryTools(registry: ToolRegistry): void {
  registry.register({
    name: 'save_memory',
    description: 'Save an important piece of information to long-term memory for future sessions.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The information to remember' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
      },
      required: ['content'],
    },
    handler: async (args, context) => {
      if (!memorySystemRef) {
        return { toolCallId: '', content: 'Memory system not initialized', isError: true };
      }

      try {
        await memorySystemRef.saveEntry({
          sessionId: context.sessionId,
          content: args.content as string,
          tags: (args.tags as string[]) || [],
          timestamp: new Date(),
        });

        return { toolCallId: '', content: 'Memory saved successfully' };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Memory save error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'memory',
  });

  registry.register({
    name: 'search_memory',
    description: 'Search long-term memory for relevant information.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results', default: 10 },
      },
      required: ['query'],
    },
    handler: async (args) => {
      if (!memorySystemRef) {
        return { toolCallId: '', content: 'Memory system not initialized', isError: true };
      }

      try {
        const results = await memorySystemRef.searchEntries(args.query as string, {
          limit: (args.limit as number) || 10,
        });

        return {
          toolCallId: '',
          content: results.length > 0
            ? `Found ${results.length} memory entries:\n\n${results.map((r, i) => `${i + 1}. ${r.content}`).join('\n\n')}`
            : 'No relevant memories found',
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Memory search error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'memory',
  });
}
