// ============================================================================
// NEXUS CLI - Hook Manager
// Pre/post execution hooks for validation, formatting, custom workflows
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { HookDefinition, HookContext, HookResult, NexusConfig, HookType } from '../types/index.js';

export class HookManager {
  private config: NexusConfig;
  private hooks: Map<HookType, HookDefinition[]> = new Map();

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async loadHooks(): Promise<void> {
    const paths = this.config.hooks.paths;

    for (const basePath of paths) {
      const resolvedPath = basePath.startsWith('~')
        ? join(process.env.HOME || process.env.USERPROFILE || '', basePath.slice(1))
        : basePath;

      if (!existsSync(resolvedPath)) continue;

      await this.loadHooksFromDir(resolvedPath);
    }
  }

  private async loadHooksFromDir(dirPath: string): Promise<void> {
    // Hooks are defined as JS/TS files that export hook definitions
    // For now, we support a simple JSON-based hook format
    try {
      const { readdirSync } = await import('fs');
      const files = readdirSync(dirPath);

      for (const file of files) {
        if (file.endsWith('.hook.json')) {
          const content = readFileSync(join(dirPath, file), 'utf-8');
          const hook = JSON.parse(content) as HookDefinition;
          this.registerHook(hook);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  registerHook(hook: HookDefinition): void {
    const hooks = this.hooks.get(hook.type) || [];
    hooks.push(hook);
    hooks.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    this.hooks.set(hook.type, hooks);
  }

  async runHooks(hookType: HookType, context: HookContext): Promise<HookResult> {
    const hooks = this.hooks.get(hookType) || [];

    for (const hook of hooks) {
      if (hook.enabled === false) continue;

      try {
        const result = await hook.handler({ ...context, hookType });
        if (!result.allowed) {
          return result;
        }
      } catch (error) {
        return {
          allowed: false,
          message: `Hook "${hook.name}" error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return { allowed: true };
  }

  // Built-in hooks
  registerBuiltInHooks(): void {
    // Safety hook: prevent dangerous commands
    this.registerHook({
      type: 'pre-tool-call',
      name: 'safety-check',
      priority: 100,
      enabled: true,
      handler: async (context) => {
        if (context.toolCall?.name === 'shell') {
          const command = (context.toolCall.input.command as string) || '';
          const dangerousPatterns = [
            'rm -rf /',
            'rm -rf ~',
            'dd if=',
            '> /dev/sda',
            'mkfs',
            'format',
          ];

          for (const pattern of dangerousPatterns) {
            if (command.includes(pattern)) {
              return {
                allowed: false,
                message: `Blocked dangerous command: ${command.slice(0, 100)}`,
              };
            }
          }
        }
        return { allowed: true };
      },
    });

    // Rate limiting hook
    const callCounts = new Map<string, number>();
    this.registerHook({
      type: 'pre-tool-call',
      name: 'rate-limit',
      priority: 50,
      enabled: true,
      handler: async (context) => {
        const key = `${context.sessionId}:${context.toolCall?.name}`;
        const count = callCounts.get(key) || 0;

        if (count > 50) {
          return {
            allowed: false,
            message: `Rate limit exceeded for tool "${context.toolCall?.name}" (${count} calls in this session)`,
          };
        }

        callCounts.set(key, count + 1);
        return { allowed: true };
      },
    });
  }
}
