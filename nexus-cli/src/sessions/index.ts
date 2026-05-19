// ============================================================================
// OpenSource CLI - Session Manager
// Create, resume, and manage agent sessions
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import type { SessionConfig, NexusEvent, EventHandler, NexusConfig, NexusEventType } from '../types/index.js';

export class SessionManager {
  private config: NexusConfig;
  private sessions: Map<string, SessionConfig> = new Map();
  private eventHandlers: Map<NexusEventType, EventHandler[]> = new Map();
  private sessionsDir: string = '';

  constructor(config: NexusConfig) {
    this.config = config;
    this.sessionsDir = join(process.env.HOME || process.env.USERPROFILE || '', '.opensource', 'sessions');

    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }

    this.loadSessions();
  }

  createSession(workdir: string): string {
    const id = uuidv4();
    const session: SessionConfig = {
      id,
      agentId: 'main',
      workdir,
      model: this.config.model,
      provider: this.config.provider,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0,
      },
    };

    this.sessions.set(id, session);
    this.saveSession(session);

    this.emitEvent({ type: 'session:start', sessionId: id, timestamp: new Date() });

    return id;
  }

  getSession(id: string): SessionConfig | undefined {
    return this.sessions.get(id);
  }

  listSessions(): SessionConfig[] {
    return Array.from(this.sessions.values()).sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  updateSession(id: string, updates: Partial<SessionConfig>): void {
    const session = this.sessions.get(id);
    if (!session) return;

    Object.assign(session, updates, { updatedAt: new Date() });
    this.saveSession(session);
  }

  private loadSessions(): void {
    if (!existsSync(this.sessionsDir)) return;

    try {
      const files = readdirSync(this.sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = readFileSync(join(this.sessionsDir, file), 'utf-8');
          const session = JSON.parse(content) as SessionConfig;
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
          this.sessions.set(session.id, session);
        }
      }
    } catch {
      // Ignore errors loading sessions
    }
  }

  private saveSession(session: SessionConfig): void {
    try {
      const filePath = join(this.sessionsDir, `${session.id}.json`);
      writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch {
      // Ignore errors saving sessions
    }
  }

  // Event system
  on(eventType: NexusEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  emitEvent(event: NexusEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }
}
