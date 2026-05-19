// ============================================================================
// OpenSource CLI - Filesystem Tools
// read_file, write_file, edit_file, read_multiple_files, list_directory
// ============================================================================

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import type { ToolRegistry } from './registry.js';
import type { ToolContext } from '../types/index.js';

export function registerFileTools(registry: ToolRegistry): void {
  // ---- read_file ----
  registry.register({
    name: 'read_file',
    description: 'Read the contents of a file. Supports text files and returns contents with line numbers.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to working directory)' },
        offset: { type: 'number', description: 'Starting line number (1-indexed)', default: 1 },
        limit: { type: 'number', description: 'Maximum number of lines to read', default: 2000 },
      },
      required: ['path'],
    },
    handler: async (args, context) => {
      const filePath = resolvePath(args.path as string, context);
      if (!existsSync(filePath)) {
        return { toolCallId: '', content: `File not found: ${args.path}`, isError: true };
      }

      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        return { toolCallId: '', content: `Path is a directory, not a file: ${args.path}`, isError: true };
      }

      // Detect binary files before reading
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const binaryExtensions = new Set([
        'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip', 'gz', 'tar', '7z', 'rar',
        'exe', 'dll', 'so', 'dylib', 'wasm',
        'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
        'ttf', 'otf', 'woff', 'woff2', 'eot',
      ]);

      // Check first few bytes for null bytes (binary content)
      const header = readFileSync(filePath, { encoding: 'latin1' }).slice(0, 1024);
      const isBinary = binaryExtensions.has(ext) || header.includes('\0') ||
        (header.length > 0 && [...header].filter(c => c.charCodeAt(0) === 0).length > 10);

      if (isBinary) {
        const size = statSync(filePath).size;
        return {
          toolCallId: '',
          content: `${args.path} is a binary file (${formatSize(size)}). Cannot read as text.`,
          isError: true,
        };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const offset = (args.offset as number) || 1;
      const limit = (args.limit as number) || 2000;
      const sliced = lines.slice(offset - 1, offset - 1 + limit);

      const totalLines = lines.length;
      const numbered = sliced.map((line, i) => `${offset + i}: ${line}`).join('\n');

      let result = `${args.path} (${totalLines} lines)\n`;
      if (offset > 1 || sliced.length < totalLines) {
        result += `lines ${offset}-${offset + sliced.length - 1}/${totalLines}\n`;
      }
      result += numbered;

      if (sliced.length >= limit && totalLines > limit) {
        result += `\n... (${totalLines - offset - sliced.length + 1} more, offset=${offset + sliced.length})`;
      }

      return { toolCallId: '', content: result };
    },
    category: 'filesystem',
  });

  // ---- write_file ----
  registry.register({
    name: 'write_file',
    description: 'Create a new file or overwrite an existing file with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to working directory)' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
    handler: async (args, context) => {
      const filePath = resolvePath(args.path as string, context);
      const dir = dirname(filePath);

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const existed = existsSync(filePath);
      writeFileSync(filePath, args.content as string, 'utf-8');

      const lines = (args.content as string).split('\n').length;
      return {
        toolCallId: '',
        content: `${existed ? 'Updated' : 'Created'} file: ${args.path} (${lines} lines)`,
      };
    },
    category: 'filesystem',
    requiresApproval: true,
  });

  // ---- edit_file ----
  registry.register({
    name: 'edit_file',
    description: 'Make targeted edits to an existing file using SEARCH/REPLACE blocks. More precise than write_file for small changes.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to working directory)' },
        diff: {
          type: 'string',
          description: 'SEARCH/REPLACE block(s) in the format:\n<<<<<<< SEARCH\nexact content to find\n=======\nnew content to replace with\n>>>>>>> REPLACE',
        },
      },
      required: ['path', 'diff'],
    },
    handler: async (args, context) => {
      const filePath = resolvePath(args.path as string, context);
      if (!existsSync(filePath)) {
        return { toolCallId: '', content: `File not found: ${args.path}`, isError: true };
      }

      const content = readFileSync(filePath, 'utf-8');
      const diff = args.diff as string;

      // Parse SEARCH/REPLACE blocks
      const blocks = parseSearchReplaceBlocks(diff);
      if (blocks.length === 0) {
        return { toolCallId: '', content: 'No valid SEARCH/REPLACE blocks found', isError: true };
      }

      let newContent = content;
      let changes = 0;

      for (const block of blocks) {
        if (!newContent.includes(block.search)) {
          return {
            toolCallId: '',
            content: `Search text not found in file:\n${block.search.slice(0, 200)}...`,
            isError: true,
          };
        }
        newContent = newContent.replace(block.search, block.replace);
        changes++;
      }

      writeFileSync(filePath, newContent, 'utf-8');
      return {
        toolCallId: '',
        content: `Applied ${changes} change(s) to ${args.path}`,
      };
    },
    category: 'filesystem',
    requiresApproval: true,
  });

  // ---- read_multiple_files ----
  registry.register({
    name: 'read_multiple_files',
    description: 'Read multiple files at once. Returns contents of all files.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to read',
        },
      },
      required: ['paths'],
    },
    handler: async (args, context) => {
      const paths = args.paths as string[];
      const results: string[] = [];

      for (const p of paths) {
        const filePath = resolvePath(p, context);
        if (!existsSync(filePath)) {
          results.push(`${p}: FILE NOT FOUND`);
          continue;
        }
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').length;
          results.push(`${p} (${lines} lines)\n---\n${content.slice(0, 3000)}${content.length > 3000 ? '\n... (truncated)' : ''}`);
        } catch (error) {
          results.push(`${p}: ERROR - ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return { toolCallId: '', content: results.join('\n\n---\n\n') };
    },
    category: 'filesystem',
  });

  // ---- list_directory ----
  registry.register({
    name: 'list_directory',
    description: 'List files and directories in a given path. Shows file sizes.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (relative to working directory)', default: '.' },
        recursive: { type: 'boolean', description: 'List recursively', default: false },
      },
      required: [],
    },
    handler: async (args, context) => {
      const dirPath = resolvePath((args.path as string) || '.', context);
      if (!existsSync(dirPath)) {
        return { toolCallId: '', content: `Directory not found: ${args.path || '.'}`, isError: true };
      }
      try {
        const stats = statSync(dirPath);
        if (!stats.isDirectory()) {
          return { toolCallId: '', content: `Path is a file, not a directory: ${args.path || '.'}`, isError: true };
        }
      } catch (error) {
        return { toolCallId: '', content: `Error accessing directory: ${error instanceof Error ? error.message : String(error)}`, isError: true };
      }

      const entries = listDirectory(dirPath, context.workdir, args.recursive as boolean);
      return { toolCallId: '', content: entries.join('\n') };
    },
    category: 'filesystem',
  });

  // ---- file_search (glob) ----
  registry.register({
    name: 'file_search',
    description: 'Find files matching a glob pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")' },
        path: { type: 'string', description: 'Base directory to search in', default: '.' },
      },
      required: ['pattern'],
    },
    handler: async (args, context) => {
      const basePath = resolvePath((args.path as string) || '.', context);
      if (!existsSync(basePath)) {
        return { toolCallId: '', content: `Base directory not found: ${args.path || '.'}`, isError: true };
      }
      try {
        const stats = statSync(basePath);
        if (!stats.isDirectory()) {
          return { toolCallId: '', content: `Base path is a file, not a directory: ${args.path || '.'}`, isError: true };
        }
      } catch (error) {
        return { toolCallId: '', content: `Error accessing base directory: ${error instanceof Error ? error.message : String(error)}`, isError: true };
      }

      try {
        const { globSync } = await import('tinyglobby');
        const files = globSync([args.pattern as string], { cwd: basePath, absolute: false });
        return {
          toolCallId: '',
          content: files.length > 0
            ? `Found ${files.length} file(s):\n${files.slice(0, 100).join('\n')}${files.length > 100 ? `\n... and ${files.length - 100} more` : ''}`
            : 'No files found matching pattern',
        };
      } catch (error) {
        return { toolCallId: '', content: `Error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
      }
    },
    category: 'filesystem',
  });
}

// ---- Helpers ----

function resolvePath(inputPath: string, context: ToolContext): string {
  if (inputPath.startsWith('/')) return inputPath;
  return join(context.workdir, inputPath);
}

function parseSearchReplaceBlocks(diff: string): Array<{ search: string; replace: string }> {
  const blocks: Array<{ search: string; replace: string }> = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match;

  while ((match = regex.exec(diff)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }

  return blocks;
}

function listDirectory(dirPath: string, workdir: string, recursive: boolean): string[] {
  const entries: string[] = [];

  function walk(currentPath: string, prefix: string) {
    const items = readdirSync(currentPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(currentPath, item.name);
      const relPath = relative(workdir, fullPath);

      if (item.isDirectory()) {
        entries.push(`${prefix}${item.name}/`);
        if (recursive) {
          walk(fullPath, prefix + '  ');
        }
      } else {
        try {
          const stats = statSync(fullPath);
          const size = formatSize(stats.size);
          entries.push(`${prefix}${item.name} (${size})`);
        } catch {
          entries.push(`${prefix}${item.name}`);
        }
      }
    }
  }

  walk(dirPath, '');
  return entries;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
