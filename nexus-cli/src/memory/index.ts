// ============================================================================
// OpenSource CLI - Memory System
// Multi-layer memory: OPENSOURCE.md (explicit), MEMORY.md (learned), FTS search
// Uses sql.js (pure JS SQLite) for cross-platform compatibility
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import type { Message, MemoryEntry, NexusConfig } from '../types/index.js';
import initSqlJs, { type Database } from 'sql.js';

export class MemorySystem {
  private config: NexusConfig;
  private db: Database | null = null;
  private workdir: string = '';
  private dbPath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async initialize(workdir: string): Promise<void> {
    this.workdir = workdir;
    const osDir = join(workdir, '.opensource');

    if (!existsSync(osDir)) {
      mkdirSync(osDir, { recursive: true });
    }

    this.dbPath = join(osDir, 'memory.db');

    // Initialize sql.js (lazy, only when needed)
    const SQL = await initSqlJs();

    // Load existing DB with corruption recovery
    try {
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);

        // Verify DB is valid by running a test query
        this.db.run('SELECT 1');
      } else {
        this.db = new SQL.Database();
      }
    } catch {
      // DB corrupted or invalid - start fresh
      console.warn('[memory] DB corrupted, creating new one');
      this.db = new SQL.Database();
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        content TEXT,
        timestamp TEXT,
        tags TEXT
      )
    `);

    // Also create index for faster searches
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memory_session
      ON memory_entries(session_id)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_memory_timestamp
      ON memory_entries(timestamp)
    `);

    this.scheduleSave();
  }

  /** Debounced write to disk — coalesces rapid writes into one I/O operation */
  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.flushDb(), 2000);
  }

  async flushDb(): Promise<void> {
    if (!this.db || this.isSaving) return;
    this.isSaving = true;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.warn('[memory] DB save failed:', err instanceof Error ? err.message : String(err));
    } finally {
      this.isSaving = false;
      this.saveTimeout = null;
    }
  }

  /** Force immediate flush (for graceful shutdown) */
  async close(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    await this.flushDb();
    this.db = null;
  }

  private saveDb(): void {
    this.scheduleSave();
  }

  async loadContext(workdir: string): Promise<string | null> {
    const parts: string[] = [];

    // Layer 1: OPENSOURCE.md (explicit project instructions)
    const opensourceMd = join(workdir, 'OPENSOURCE.md');
    if (existsSync(opensourceMd)) {
      parts.push(`## Project Instructions (OPENSOURCE.md)\n${readFileSync(opensourceMd, 'utf-8')}`);
    }

    // Layer 2: MEMORY.md (learned patterns)
    const memoryMd = join(workdir, '.opensource', 'MEMORY.md');
    if (existsSync(memoryMd)) {
      const content = readFileSync(memoryMd, 'utf-8');
      const truncated = content.length > 25000 ? content.slice(0, 25000) + '...\n(truncated)' : content;
      parts.push(`## Learned Memory (MEMORY.md)\n${truncated}`);
    }

    // Layer 3: Obsidian Vault (if configured)
    const vaultPath = this.config.obsidian?.vaultPath;
    if (this.config.obsidian?.enabled && vaultPath && existsSync(vaultPath)) {
      const vaultSummary = await this.summarizeVault(vaultPath);
      if (vaultSummary) {
        parts.push(`## Obsidian Vault Knowledge\n${vaultSummary}`);
      }
    }

    // Layer 4: Recent conversation summaries
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          SELECT content, timestamp FROM memory_entries
          ORDER BY rowid DESC LIMIT 5
        `);
        const recent: Array<{ content: string; timestamp: string }> = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          recent.push({ content: String(row.content || ''), timestamp: String(row.timestamp || '') });
        }
        stmt.free();

        if (recent.length > 0) {
          parts.push(`## Recent Conversations\n${recent.map(r => `- ${r.timestamp}: ${r.content.slice(0, 200)}`).join('\n')}`);
        }
      } catch {
        // Ignore errors
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  private async summarizeVault(vaultPath: string): Promise<string | null> {
    try {
      const { readdirSync, statSync, readFileSync, existsSync } = await import('fs');
      const { join, basename, relative } = await import('path');

      const notes: string[] = [];
      const tags = new Set<string>();

      function walkDir(dir: string) {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.name.startsWith('.') && entry.name !== vaultPath) continue;
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const title = basename(entry.name, '.md');
              const relPath = relative(vaultPath, fullPath);

              // Extract tags
              const tagMatches = content.match(/#(\w+)/g);
              if (tagMatches) tagMatches.forEach(t => tags.add(t.slice(1)));

              // Extract first heading
              const heading = content.match(/^#\s+(.+)$/m);
              const noteTitle = heading ? heading[1].trim() : title;

              // Extract wikilinks
              const linkMatches = content.match(/\[\[([^\]|]+)/g);
              const linkCount = linkMatches ? linkMatches.length : 0;

              notes.push(`- ${noteTitle} (${relPath})${linkCount > 0 ? ` [${linkCount} links]` : ''}`);
            } catch { /* skip */ }
          }
        }
      }

      walkDir(vaultPath);

      if (notes.length === 0) return null;

      return `Vault: ${vaultPath}\nTotal notes: ${notes.length}\nTags: ${[...tags].slice(0, 30).join(', ') || 'none'}\n\nTop notes:\n${notes.slice(0, 20).join('\n')}${notes.length > 20 ? `\n... and ${notes.length - 20} more` : ''}`;
    } catch {
      return null;
    }
  }

  async saveConversation(sessionId: string, messages: Message[]): Promise<void> {
    if (!this.db || !this.workdir) return;

    const assistantMessages = messages.filter(m => m.role === 'assistant' && typeof m.content === 'string');
    if (assistantMessages.length === 0) return;

    const summary = assistantMessages
      .map(m => (m.content as string).slice(0, 500))
      .join('\n---\n');

    const id = `session_${sessionId}_${Date.now()}`;
    this.db.run(`
      INSERT OR REPLACE INTO memory_entries (id, session_id, content, timestamp, tags)
      VALUES (?, ?, ?, ?, ?)
    `, [id, sessionId, summary.slice(0, 5000), new Date().toISOString(), JSON.stringify(['conversation'])]);

    this.saveDb();
  }

  async saveEntry(entry: Omit<MemoryEntry, 'id'>): Promise<void> {
    if (!this.db || !this.workdir) return;

    const id = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.run(`
      INSERT OR REPLACE INTO memory_entries (id, session_id, content, timestamp, tags)
      VALUES (?, ?, ?, ?, ?)
    `, [id, entry.sessionId, entry.content, entry.timestamp.toISOString(), JSON.stringify(entry.tags)]);

    this.saveDb();
  }

  async searchEntries(query: string, options: { limit?: number } = {}): Promise<Array<{ content: string; timestamp: string }>> {
    if (!this.db) return [];

    const limit = options.limit || 10;

    // Simple text search (no FTS5 in sql.js)
    const stmt = this.db.prepare(`
      SELECT content, timestamp FROM memory_entries
      WHERE content LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const results: Array<{ content: string; timestamp: string }> = [];
    stmt.bind([`%${query}%`, limit]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({ content: String(row.content || ''), timestamp: String(row.timestamp || '') });
    }
    stmt.free();

    return results;
  }

  async getAllLayers(workdir: string): Promise<Record<string, string>> {
    const layers: Record<string, string> = {};

    const opensourceMd = join(workdir, 'OPENSOURCE.md');
    if (existsSync(opensourceMd)) {
      layers['OPENSOURCE.md'] = readFileSync(opensourceMd, 'utf-8');
    }

    const memoryMd = join(workdir, '.opensource', 'MEMORY.md');
    if (existsSync(memoryMd)) {
      layers['MEMORY.md'] = readFileSync(memoryMd, 'utf-8');
    }

    if (this.db) {
      try {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memory_entries');
        let count = 0;
        if (stmt.step()) {
          const row = stmt.getAsObject();
          count = Number(row.count || 0);
        }
        stmt.free();
        layers['Database'] = `${count} entries stored`;
      } catch {
        layers['Database'] = '0 entries stored';
      }
    }

    return layers;
  }

  async appendLearnedMemory(workdir: string, content: string): Promise<void> {
    const memoryMd = join(workdir, '.opensource', 'MEMORY.md');
    const osDir = join(workdir, '.opensource');

    if (!existsSync(osDir)) {
      mkdirSync(osDir, { recursive: true });
    }

    appendFileSync(memoryMd, `\n## ${new Date().toISOString()}\n${content}\n`, 'utf-8');
  }

  async clearLearned(workdir: string): Promise<void> {
    const memoryMd = join(workdir, '.opensource', 'MEMORY.md');
    if (existsSync(memoryMd)) {
      writeFileSync(memoryMd, '', 'utf-8');
    }

    if (this.db) {
      this.db.run('DELETE FROM memory_entries');
      this.saveDb();
    }
  }
}
