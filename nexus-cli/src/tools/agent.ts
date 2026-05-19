// ============================================================================
// OpenSource CLI - Agent Tool
// Spawn sub-agents for parallel task execution
// ============================================================================

import type { ToolRegistry } from './registry.js';
import type { OpenSourceAgent } from '../core/agent.js';

let agentFactoryRef: ((config: Record<string, unknown>) => Promise<OpenSourceAgent>) | null = null;

export function setAgentFactoryRef(factory: (config: Record<string, unknown>) => Promise<OpenSourceAgent>): void {
  agentFactoryRef = factory;
}

export function registerAgentTools(registry: ToolRegistry): void {
  registry.register({
    name: 'spawn_agent',
    description: 'Spawn a sub-agent to work on a specific task in parallel. The sub-agent has its own context and tools, and returns its result when complete.',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task for the sub-agent to complete' },
        agent_type: { type: 'string', description: 'Type of agent: researcher, coder, reviewer, tester', default: 'coder' },
        workdir: { type: 'string', description: 'Working directory for the sub-agent' },
        context_files: { type: 'array', items: { type: 'string' }, description: 'Files to provide as context' },
      },
      required: ['task'],
    },
    handler: async (args, context) => {
      if (!agentFactoryRef) {
        return {
          toolCallId: '',
          content: 'Agent factory not initialized. Sub-agents are not available.',
          isError: true,
        };
      }

      const task = args.task as string;
      const agentType = (args.agent_type as string) || 'coder';
      const workdir = (args.workdir as string) || context.workdir;

      const systemPrompts: Record<string, string> = {
        coder: 'You are a coding specialist. Focus on writing clean, correct code. Always read files before modifying them. Test your changes.',
        researcher: 'You are a research specialist. Focus on exploring the codebase, finding patterns, and gathering information. Do not modify files.',
        reviewer: 'You are a code review specialist. Focus on finding bugs, security issues, and code quality problems. Do not modify files.',
        tester: 'You are a testing specialist. Focus on writing and running tests. Identify test gaps and create comprehensive test coverage.',
      };

      try {
        if (!agentFactoryRef) {
          return { toolCallId: '', content: 'Agent factory not available', isError: true };
        }
        const factory = agentFactoryRef;
        const subAgent = await factory({
          name: `sub-${agentType}-${Date.now()}`,
          systemPrompt: systemPrompts[agentType] || systemPrompts.coder,
          workdir,
          maxIterations: 30,
        });

        const result = await subAgent.run(task);

        return {
          toolCallId: '',
          content: `Sub-agent (${agentType}) completed:\n\n${result}`,
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Sub-agent error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'agent',
    requiresApproval: true,
  });

  registry.register({
    name: 'parallel_agents',
    description: 'Spawn multiple sub-agents to work on different tasks in parallel. Returns all results when all agents complete.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              agent_type: { type: 'string' },
            },
          },
          description: 'Array of tasks with optional agent types',
        },
      },
      required: ['tasks'],
    },
    handler: async (args, context) => {
      if (!agentFactoryRef) {
        return { toolCallId: '', content: 'Agent factory not initialized', isError: true };
      }

      const tasks = args.tasks as Array<{ task: string; agent_type?: string }>;

      try {
        if (!agentFactoryRef) {
          return { toolCallId: '', content: 'Agent factory not available', isError: true };
        }
        const factory = agentFactoryRef;
        const results = await Promise.all(
          tasks.map(async (t) => {
            const subAgent = await factory({
              name: `sub-${t.agent_type || 'coder'}-${Date.now()}`,
              workdir: context.workdir,
              maxIterations: 30,
            });
            const result = await subAgent.run(t.task);
            return `Task: ${t.task}\nAgent: ${t.agent_type || 'coder'}\nResult: ${result}`;
          })
        );

        return {
          toolCallId: '',
          content: `All ${tasks.length} sub-agents completed:\n\n${results.join('\n\n---\n\n')}`,
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Parallel agent error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'agent',
    requiresApproval: true,
  });
}
