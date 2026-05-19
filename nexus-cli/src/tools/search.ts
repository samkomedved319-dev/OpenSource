// ============================================================================
// OpenSource CLI - Search Tools
// Code search with regex and content grep
// ============================================================================

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import type { ToolRegistry } from './registry.js';

export function registerSearchTools(registry: ToolRegistry): void {
  // ---- search_files (grep) ----
  registry.register({
    name: 'search_files',
    description: 'Search file contents using regex. Returns matching lines with file paths and line numbers.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in', default: '.' },
        include: { type: 'string', description: 'File glob pattern to include (e.g., "*.ts")' },
        exclude: { type: 'string', description: 'File glob pattern to exclude' },
        maxResults: { type: 'number', description: 'Maximum number of results', default: 100 },
      },
      required: ['pattern'],
    },
    handler: async (args, context) => {
      const basePath = join(context.workdir, (args.path as string) || '.');
      const { existsSync, statSync } = await import('fs');
      if (!existsSync(basePath)) {
        return { toolCallId: '', content: `Search directory not found: ${args.path || '.'}`, isError: true };
      }
      try {
        const stats = statSync(basePath);
        if (!stats.isDirectory()) {
          return { toolCallId: '', content: `Search path is a file, not a directory: ${args.path || '.'}`, isError: true };
        }
      } catch (error) {
        return { toolCallId: '', content: `Error accessing search path: ${error instanceof Error ? error.message : String(error)}`, isError: true };
      }

      const pattern = args.pattern as string;
      const include = (args.include as string) || '*';
      const exclude = (args.exclude as string) || '';
      const maxResults = (args.maxResults as number) || 100;

      try {
        const { globSync } = await import('tinyglobby');
        const files = globSync([include], {
          cwd: basePath,
          absolute: true,
          ignore: exclude ? [exclude] : undefined,
        });

        const regex = new RegExp(pattern, 'gi');
        const results: string[] = [];

        for (const file of files) {
          if (results.length >= maxResults) break;

          try {
            const stats = statSync(file);
            if (stats.size > 1024 * 1024) continue; // Skip files > 1MB

            const content = readFileSync(file, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;
              if (regex.test(lines[i])) {
                const relPath = relative(context.workdir, file);
                results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
              }
            }
          } catch {
            // Skip binary or unreadable files
          }
        }

        return {
          toolCallId: '',
          content: results.length > 0
            ? `Found ${results.length} match(es) for pattern "${pattern}":\n${results.join('\n')}`
            : `No matches found for pattern "${pattern}"`,
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Search error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'search',
  });

  // ---- find_symbol ----
  registry.register({
    name: 'find_symbol',
    description: 'Find definitions of a symbol (function, class, variable) across the codebase.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to find' },
        type: { type: 'string', description: 'Symbol type: function, class, variable, import', enum: ['function', 'class', 'variable', 'import'] },
      },
      required: ['symbol'],
    },
    handler: async (args, context) => {
      const symbol = args.symbol as string;
      const type = args.type as string;

      // Build patterns based on symbol type
      const patterns: string[] = [];
      if (!type || type === 'function') {
        patterns.push(`(?:function|def|fn|func)\\s+${symbol}`);
        patterns.push(`(?:const|let|var)\\s+${symbol}\\s*=`);
        patterns.push(`${symbol}\\s*[=:]\\s*(?:function|\\(|{)`);
      }
      if (!type || type === 'class') {
        patterns.push(`class\\s+${symbol}`);
        patterns.push(`interface\\s+${symbol}`);
        patterns.push(`type\\s+${symbol}\\s*=`);
      }
      if (!type || type === 'import') {
        patterns.push(`import.*${symbol}`);
        patterns.push(`from.*${symbol}`);
        patterns.push(`require.*${symbol}`);
      }

      const results: string[] = [];
      for (const pattern of patterns) {
        try {
          const { globSync } = await import('tinyglobby');
          const files = globSync(['**/*.{ts,tsx,js,jsx,py,rs,go,java,c,cpp,h,hpp}'], {
            cwd: context.workdir,
            absolute: true,
          });

          const regex = new RegExp(pattern, 'gi');
          for (const file of files.slice(0, 500)) {
            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  const relPath = relative(context.workdir, file);
                  results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                  if (results.length >= 50) break;
                }
              }
            } catch { /* skip */ }
            if (results.length >= 50) break;
          }
        } catch { /* skip */ }
        if (results.length >= 50) break;
      }

      return {
        toolCallId: '',
        content: results.length > 0
          ? `Found ${results.length} definition(s) for "${symbol}":\n${results.join('\n')}`
          : `No definitions found for "${symbol}"`,
      };
    },
    category: 'search',
  });
}
