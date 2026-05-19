// ============================================================================
// OpenSource CLI - Git Tools
// Git operations: status, diff, log, commit, branch, etc.
// ============================================================================

import { execa } from 'execa';
import type { ToolRegistry } from './registry.js';

export function registerGitTools(registry: ToolRegistry): void {
  registry.register({
    name: 'git',
    description: 'Execute git commands. Use for status, diff, log, commit, branch, push, pull, etc.',
    parameters: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'Git arguments (e.g., "status", "diff HEAD", "log --oneline -10")' },
      },
      required: ['args'],
    },
    handler: async (args, context) => {
      try {
        const result = await execa('git', (args.args as string).split(' '), {
          cwd: context.workdir,
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });

        let output = result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;

        return {
          toolCallId: '',
          content: output.slice(0, 30000),
        };
      } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string };
        return {
          toolCallId: '',
          content: `Git error: ${execError.stderr || execError.stdout || String(error)}`,
          isError: true,
        };
      }
    },
    category: 'git',
    requiresApproval: true,
  });

  // Quick git status
  registry.register({
    name: 'git_status',
    description: 'Get a quick summary of git status (modified, staged, untracked files).',
    parameters: { type: 'object', properties: {} },
    handler: async (_args, context) => {
      try {
        const { stdout } = await execa('git', ['status', '--short'], {
          cwd: context.workdir,
          timeout: 10000,
        });
        return { toolCallId: '', content: stdout || 'Working tree is clean' };
      } catch {
        return { toolCallId: '', content: 'Not a git repository', isError: true };
      }
    },
    category: 'git',
  });
}
