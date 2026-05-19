// ============================================================================
// OpenSource CLI - Shell Tool
// Execute shell commands with timeout and output capture
// ============================================================================

import { execa } from 'execa';
import type { ToolRegistry } from './registry.js';

export function registerShellTools(registry: ToolRegistry): void {
  registry.register({
    name: 'shell',
    description: 'Execute a shell command and return its output. Use for building, testing, running scripts, git operations, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        workdir: { type: 'string', description: 'Working directory for the command (relative to project root)' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 120000 },
      },
      required: ['command'],
    },
    handler: async (args, context) => {
      const command = args.command as string;
      const timeout = (args.timeout as number) || 120000;
      const cwd = args.workdir
        ? require('path').join(context.workdir, args.workdir as string)
        : context.workdir;

      try {
        const result = await execa(command, {
          cwd,
          shell: true,
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          signal: context.signal,
        });

        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;

        const truncated = output.length > 50000
          ? output.slice(0, 50000) + '\n... (output truncated, max 50000 chars)'
          : output;

        return {
          toolCallId: '',
          content: `Command: ${command}\nExit code: ${result.exitCode}\n\n${truncated}`,
          metadata: { exitCode: result.exitCode, command },
        };
      } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; exitCode?: number; signal?: string };
        let output = '';
        if (execError.stdout) output += execError.stdout;
        if (execError.stderr) output += (output ? '\n' : '') + execError.stderr;

        return {
          toolCallId: '',
          content: `Command: ${command}\nExit code: ${execError.exitCode ?? 'unknown'}\nSignal: ${execError.signal ?? 'none'}\n\n${output || 'No output'}`,
          isError: true,
          metadata: { exitCode: execError.exitCode, command },
        };
      }
    },
    category: 'shell',
    requiresApproval: true,
  });
}
