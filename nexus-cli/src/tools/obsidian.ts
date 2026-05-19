// ============================================================================
// OpenSource CLI - Obsidian Vault Tools
// Full integration with Obsidian markdown knowledge base
// Read, write, search, link, and navigate notes
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, appendFileSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { ToolRegistry } from './registry.js';
import type { ToolContext } from '../types/index.js';
import type { NexusConfig } from '../types/index.js';

// Vault index cache
interface VaultIndex {
  notes: Map<string, VaultNote>;
  links: Map<string, string[]>; // note -> [linked notes]
  backlinks: Map<string, string[]>; // note -> [notes that link to it]
  tags: Map<string, string[]>; // tag -> [notes]
  lastIndexed: Date;
}

interface VaultNote {
  path: string;
  title: string;
  content: string;
  tags: string[];
  links: string[]; // [[wikilinks]]
  created: Date;
  modified: Date;
  frontmatter: Record<string, string>;
}

let vaultIndex: VaultIndex | null = null;

export function setVaultConfig(config: NexusConfig): void {
  if (config.obsidian?.enabled && config.obsidian.vaultPath) {
    indexVault(config.obsidian.vaultPath, config.obsidian.excludePatterns || []);
  }
}

export function registerObsidianTools(registry: ToolRegistry, config: NexusConfig): void {
  // Set vault config and index on first tool registration
  if (config.obsidian?.enabled && config.obsidian.vaultPath) {
    setVaultConfig(config);
  }

  // ---- obsidian_read_note ----
  registry.register({
    name: 'obsidian_read_note',
    description: 'Read a note from the Obsidian vault by title or path. Returns full content with frontmatter.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title (without .md extension)' },
        path: { type: 'string', description: 'Note path relative to vault root' },
      },
      required: [],
    },
    handler: async (args, context) => {
      const vaultPath = getVaultPath(context, config);
      if (!vaultPath) {
        return { toolCallId: '', content: 'No Obsidian vault configured. Set obsidian.vaultPath in opensource.json', isError: true };
      }

      const title = args.title as string;
      const notePath = args.path as string;

      let filePath = '';
      if (notePath) {
        filePath = join(vaultPath, notePath.endsWith('.md') ? notePath : `${notePath}.md`);
      } else if (title) {
        filePath = findNoteByTitle(vaultPath, title);
      }

      if (!filePath || !existsSync(filePath)) {
        const suggestions = title ? findSimilarNotes(vaultPath, title) : [];
        return {
          toolCallId: '',
          content: `Note not found: ${title || notePath}${suggestions.length > 0 ? `\n\nSimilar notes:\n${suggestions.join('\n')}` : ''}`,
          isError: true,
        };
      }

      const content = readFileSync(filePath, 'utf-8');
      const parsed = parseNote(content, filePath, vaultPath);

      return {
        toolCallId: '',
        content: `# ${parsed.title}\nPath: ${relative(vaultPath, filePath)}\nTags: ${parsed.tags.join(', ') || 'none'}\nLinks: ${parsed.links.join(', ') || 'none'}\n\n${parsed.content}`,
        metadata: { frontmatter: parsed.frontmatter, links: parsed.links, tags: parsed.tags },
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_write_note ----
  registry.register({
    name: 'obsidian_write_note',
    description: 'Create or update a note in the Obsidian vault. Supports frontmatter and wikilinks.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content (markdown)' },
        path: { type: 'string', description: 'Note path relative to vault root (optional, auto-generated from title)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the note' },
        append: { type: 'boolean', description: 'Append to existing note instead of overwriting', default: false },
      },
      required: ['title', 'content'],
    },
    handler: async (args, context) => {
      const vaultPath = getVaultPath(context, config);
      if (!vaultPath) {
        return { toolCallId: '', content: 'No Obsidian vault configured', isError: true };
      }

      const title = args.title as string;
      const content = args.content as string;
      const tags = args.tags as string[] | undefined;
      const append = args.append as boolean;

      let filePath: string;
      if (args.path && typeof args.path === 'string') {
        filePath = join(vaultPath, args.path.endsWith('.md') ? args.path : `${args.path}.md`);
      } else {
        filePath = join(vaultPath, `${title.replace(/[\\/<>:"|?*]/g, '-')}.md`);
      }

      // Create parent directories
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Build note content with frontmatter
      let noteContent = '';
      if (tags && tags.length > 0) {
        noteContent += `---\ntags: [${tags.join(', ')}]\ncreated: ${new Date().toISOString()}\n---\n\n`;
      }

      noteContent += `# ${title}\n\n${content}`;

      if (append && existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8');
        appendFileSync(filePath, `\n\n---\n\n${noteContent}`, 'utf-8');
      } else {
        writeFileSync(filePath, noteContent, 'utf-8');
      }

      // Re-index
      indexVault(vaultPath, config.obsidian?.excludePatterns || []);

      return {
        toolCallId: '',
        content: `Note ${append ? 'appended to' : 'created'}: ${relative(vaultPath, filePath)}`,
      };
    },
    category: 'obsidian',
    requiresApproval: true,
  });

  // ---- obsidian_search_notes ----
  registry.register({
    name: 'obsidian_search_notes',
    description: 'Search across all notes in the Obsidian vault. Returns matching notes with context.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (text or regex)' },
        tag: { type: 'string', description: 'Filter by tag' },
        maxResults: { type: 'number', description: 'Maximum results', default: 20 },
      },
      required: ['query'],
    },
    handler: async (args) => {
      if (!vaultIndex) {
        return { toolCallId: '', content: 'Vault not indexed', isError: true };
      }

      const query = (args.query as string).toLowerCase();
      const tag = args.tag as string | undefined;
      const maxResults = (args.maxResults as number) || 20;

      const results: string[] = [];

      for (const [title, note] of vaultIndex.notes.entries()) {
        // Tag filter
        if (tag && !note.tags.includes(tag)) continue;

        // Search in title, content, tags
        const matches =
          title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some(t => t.toLowerCase().includes(query));

        if (matches) {
          const preview = note.content.slice(0, 300);
          results.push(`## ${title}\nPath: ${note.path}\nTags: ${note.tags.join(', ') || 'none'}\n\n${preview}${note.content.length > 300 ? '...' : ''}`);
        }

        if (results.length >= maxResults) break;
      }

      return {
        toolCallId: '',
        content: results.length > 0
          ? `Found ${results.length} note(s) for "${query}":\n\n${results.join('\n\n---\n\n')}`
          : `No notes found for "${query}"`,
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_list_notes ----
  registry.register({
    name: 'obsidian_list_notes',
    description: 'List all notes in the Obsidian vault with their tags and link counts.',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Filter by tag' },
        path: { type: 'string', description: 'Filter by folder path' },
      },
    },
    handler: async (args) => {
      if (!vaultIndex) {
        return { toolCallId: '', content: 'Vault not indexed', isError: true };
      }

      const tag = args.tag as string | undefined;
      const pathFilter = args.path as string | undefined;

      const notes: string[] = [];
      for (const [title, note] of vaultIndex.notes.entries()) {
        if (tag && !note.tags.includes(tag)) continue;
        if (pathFilter && !note.path.startsWith(pathFilter)) continue;

        const backlinkCount = (vaultIndex.backlinks.get(title) || []).length;
        const linkCount = note.links.length;
        notes.push(`- **${title}** (${note.path})\n  Tags: ${note.tags.join(', ') || 'none'} | Links: ${linkCount} | Backlinks: ${backlinkCount}`);
      }

      return {
        toolCallId: '',
        content: notes.length > 0
          ? `Vault notes (${notes.length}):\n\n${notes.join('\n')}`
          : 'No notes found',
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_find_backlinks ----
  registry.register({
    name: 'obsidian_find_backlinks',
    description: 'Find all notes that link to a specific note (backlinks).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title to find backlinks for' },
      },
      required: ['title'],
    },
    handler: async (args) => {
      if (!vaultIndex) {
        return { toolCallId: '', content: 'Vault not indexed', isError: true };
      }

      const title = args.title as string;
      const backlinks = vaultIndex.backlinks.get(title) || [];

      if (backlinks.length === 0) {
        return { toolCallId: '', content: `No notes link to "${title}"` };
      }

      const results = backlinks.map(linkingNote => {
        const note = vaultIndex!.notes.get(linkingNote);
        return note ? `- **${linkingNote}** (${note.path})` : `- ${linkingNote}`;
      });

      return {
        toolCallId: '',
        content: `Backlinks to "${title}" (${backlinks.length}):\n\n${results.join('\n')}`,
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_find_links ----
  registry.register({
    name: 'obsidian_find_links',
    description: 'Find all notes that a specific note links to (outgoing links).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title to find outgoing links for' },
      },
      required: ['title'],
    },
    handler: async (args) => {
      if (!vaultIndex) {
        return { toolCallId: '', content: 'Vault not indexed', isError: true };
      }

      const title = args.title as string;
      const links = vaultIndex.notes.get(title)?.links || [];

      if (links.length === 0) {
        return { toolCallId: '', content: `"${title}" has no outgoing links` };
      }

      const results = links.map(linkedNote => {
        const note = vaultIndex!.notes.get(linkedNote);
        return note ? `- **${linkedNote}** (${note.path})` : `- ${linkedNote}`;
      });

      return {
        toolCallId: '',
        content: `"${title}" links to (${links.length}):\n\n${results.join('\n')}`,
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_graph ----
  registry.register({
    name: 'obsidian_graph',
    description: 'Get vault graph statistics: total notes, tags, most connected notes, orphan notes.',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      if (!vaultIndex) {
        return { toolCallId: '', content: 'Vault not indexed', isError: true };
      }

      const totalNotes = vaultIndex.notes.size;
      const allTags = new Set<string>();
      for (const note of vaultIndex.notes.values()) {
        note.tags.forEach(t => allTags.add(t));
      }

      // Most connected notes
      const connections = new Map<string, number>();
      for (const [note, links] of vaultIndex.backlinks.entries()) {
        connections.set(note, links.length);
      }
      const mostConnected = [...connections.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([note, count]) => `- ${note} (${count} backlinks)`);

      // Orphan notes (no links and no backlinks)
      const orphans: string[] = [];
      for (const [title, note] of vaultIndex.notes.entries()) {
        const hasLinks = note.links.length > 0;
        const hasBacklinks = (vaultIndex.backlinks.get(title) || []).length > 0;
        if (!hasLinks && !hasBacklinks) {
          orphans.push(`- ${title} (${note.path})`);
        }
      }

      return {
        toolCallId: '',
        content: `## Vault Graph Statistics

- **Total notes**: ${totalNotes}
- **Total tags**: ${allTags.size}
- **Tags**: ${[...allTags].slice(0, 20).join(', ')}${allTags.size > 20 ? '...' : ''}

### Most Connected Notes
${mostConnected.join('\n') || 'None'}

### Orphan Notes (${orphans.length})
${orphans.slice(0, 10).join('\n') || 'None'}${orphans.length > 10 ? `\n... and ${orphans.length - 10} more` : ''}`,
      };
    },
    category: 'obsidian',
  });

  // ---- obsidian_reindex ----
  registry.register({
    name: 'obsidian_reindex',
    description: 'Re-index the Obsidian vault. Use after external changes to the vault.',
    parameters: { type: 'object', properties: {} },
    handler: async (args, context) => {
      const vaultPath = getVaultPath(context, config);
      if (!vaultPath) {
        return { toolCallId: '', content: 'No Obsidian vault configured', isError: true };
      }

      indexVault(vaultPath, config.obsidian?.excludePatterns || []);

      return {
        toolCallId: '',
        content: `Vault re-indexed: ${vaultIndex?.notes.size || 0} notes, ${vaultIndex?.links.size || 0} links`,
      };
    },
    category: 'obsidian',
  });
}

// ---- Helper Functions ----

function getVaultPath(context: ToolContext, config: NexusConfig): string | null {
  return config.obsidian?.vaultPath || null;
}

function indexVault(vaultPath: string, excludePatterns: string[]): void {
  vaultIndex = {
    notes: new Map(),
    links: new Map(),
    backlinks: new Map(),
    tags: new Map(),
    lastIndexed: new Date(),
  };

  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip excluded patterns
      if (excludePatterns.some(p => entry.name === p || entry.name.startsWith('.'))) continue;

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const parsed = parseNote(content, fullPath, vaultPath);
          vaultIndex!.notes.set(parsed.title, parsed);
          vaultIndex!.links.set(parsed.title, parsed.links);

          // Index tags
          for (const tag of parsed.tags) {
            const tagNotes = vaultIndex!.tags.get(tag) || [];
            tagNotes.push(parsed.title);
            vaultIndex!.tags.set(tag, tagNotes);
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walkDir(vaultPath);

  // Build backlinks
  for (const [title, links] of vaultIndex.links.entries()) {
    for (const link of links) {
      const backlinks = vaultIndex!.backlinks.get(link) || [];
      backlinks.push(title);
      vaultIndex!.backlinks.set(link, backlinks);
    }
  }
}

function parseNote(content: string, filePath: string, vaultPath: string): VaultNote {
  const title = basename(filePath, '.md');
  const relPath = relative(vaultPath, filePath);

  // Extract frontmatter
  const frontmatter: Record<string, string> = {};
  let contentBody = content;
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        frontmatter[match[1]] = match[2].trim();
      }
    }
    contentBody = fmMatch[2];
  }

  // Extract tags
  const tags: string[] = [];
  const fmTags = frontmatter.tags;
  if (fmTags) {
    if (fmTags.startsWith('[')) {
      tags.push(...fmTags.slice(1, -1).split(',').map(t => t.trim().replace(/^#/, '')));
    } else {
      tags.push(...fmTags.split(' ').map(t => t.trim().replace(/^#/, '')));
    }
  }
  // Also find inline tags
  const inlineTagRegex = /#(\w+)/g;
  let tagMatch;
  while ((tagMatch = inlineTagRegex.exec(contentBody)) !== null) {
    const tag = tagMatch[1];
    if (!tags.includes(tag)) tags.push(tag);
  }

  // Extract [[wikilinks]]
  const links: string[] = [];
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(contentBody)) !== null) {
    const link = linkMatch[1].trim();
    if (!links.includes(link)) links.push(link);
  }

  // Extract title from first heading
  const headingMatch = contentBody.match(/^#\s+(.+)$/m);
  const noteTitle = headingMatch ? headingMatch[1].trim() : title;

  const stats = statSync(filePath);

  return {
    path: relPath,
    title: noteTitle,
    content: contentBody.trim(),
    tags,
    links,
    created: stats.birthtime,
    modified: stats.mtime,
    frontmatter,
  };
}

function findNoteByTitle(vaultPath: string, title: string): string {
  // Try exact match first
  const exactPath = join(vaultPath, `${title}.md`);
  if (existsSync(exactPath)) return exactPath;

  // Search recursively
  function searchDir(dir: string): string | null {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const found = searchDir(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === `${title}.md`) {
        return fullPath;
      }
    }
    return null;
  }

  return searchDir(vaultPath) || '';
}

function findSimilarNotes(vaultPath: string, title: string): string[] {
  const suggestions: string[] = [];
  const query = title.toLowerCase();

  function searchDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        searchDir(fullPath);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        const noteTitle = basename(entry.name, '.md').toLowerCase();
        if (noteTitle.includes(query) || query.includes(noteTitle)) {
          suggestions.push(`- ${basename(entry.name, '.md')} (${relative(vaultPath, fullPath)})`);
        }
      }
    }
  }

  searchDir(vaultPath);
  return suggestions.slice(0, 5);
}
