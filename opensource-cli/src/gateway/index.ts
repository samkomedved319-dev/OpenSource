// ============================================================================
// OpenSource CLI - Gateway (Daemon Mode)
// ============================================================================

import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { GatewayConfig, GatewayState, NexusConfig } from '../types/index.js';

export class Gateway {
  private config: NexusConfig;
  private state: GatewayState;
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: NexusConfig) {
    this.config = config;
    this.state = {
      running: false,
      startTime: new Date(),
      activeSessions: [],
      agentStates: new Map(),
      channelConnections: new Map(),
    };
  }

  async start(): Promise<void> {
    console.log('Starting OpenSource Gateway...');

    this.httpServer = createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const { findProjectRoot } = await import('../config/index.js');
      const { existsSync, writeFileSync, readFileSync, readdirSync } = await import('fs');
      const { join } = await import('path');

      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'running',
          uptime: Date.now() - this.state.startTime.getTime(),
          activeSessions: this.state.activeSessions.length,
        }));
        return;
      }

      if (url.pathname === '/api/doctor') {
        let ollamaStatus = 'OFFLINE';
        let ollamaModels: string[] = [];
        try {
          const oRes = await fetch('http://localhost:11434/api/tags');
          if (oRes.ok) {
            ollamaStatus = 'ONLINE';
            const oData = await oRes.json() as { models?: Array<{ name: string }> };
            ollamaModels = (oData.models || []).map(m => m.name);
          }
        } catch {}

        let gitStatus = 'NO_REPO';
        let gitBranch = '';
        let gitChanges = 0;
        try {
          const { execSync } = await import('child_process');
          gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
          gitStatus = 'READY';
          const statusOutput = execSync('git status --porcelain', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
          gitChanges = statusOutput ? statusOutput.split('\n').length : 0;
        } catch {}

        let obsidianStatus = 'DISCONNECTED';
        let noteCount = 0;
        let tagCount = 0;
        const vaultPath = this.config.obsidian?.vaultPath;
        if (vaultPath && existsSync(vaultPath)) {
          obsidianStatus = 'CONNECTED';
          const tags = new Set<string>();
          const walk = (dir: string) => {
            try {
              const entries = readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const full = join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                  noteCount++;
                  try {
                    const content = readFileSync(full, 'utf-8');
                    const matches = content.match(/#(\w+)/g);
                    if (matches) matches.forEach(t => tags.add(t.slice(1)));
                  } catch {}
                }
              }
            } catch {}
          };
          walk(vaultPath);
          tagCount = tags.size;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ollama: { status: ollamaStatus, models: ollamaModels },
          git: { status: gitStatus, branch: gitBranch, changes: gitChanges },
          obsidian: { status: obsidianStatus, vaultPath, noteCount, tagCount },
          config: {
            provider: this.config.provider,
            model: this.config.model,
            memory: this.config.memory,
            skills: this.config.skills,
            agent: this.config.agent,
          }
        }));
        return;
      }

      if (url.pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const updates = JSON.parse(body);
            const root = findProjectRoot(process.cwd()) || process.cwd();
            const projectDir = join(root, '.opensource');
            if (!existsSync(projectDir)) {
              const { mkdirSync } = await import('fs');
              mkdirSync(projectDir, { recursive: true });
            }
            const configPath = join(projectDir, 'opensource.json');
            
            let currentConfig = { ...this.config };
            if (existsSync(configPath)) {
              try {
                currentConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
              } catch {}
            }

            const merge = (target: any, source: any) => {
              for (const k of Object.keys(source)) {
                if (typeof source[k] === 'object' && source[k] !== null && !Array.isArray(source[k])) {
                  if (!target[k]) target[k] = {};
                  merge(target[k], source[k]);
                } else {
                  target[k] = source[k];
                }
              }
            };
            merge(currentConfig, updates);
            writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
            merge(this.config, updates);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', config: this.config }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
          }
        });
        return;
      }

      if (url.pathname === '/api/models/pull' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { model } = JSON.parse(body);
            if (!model) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: 'Model name is required' }));
              return;
            }

            const oRes = await fetch('http://localhost:11434/api/pull', {
              method: 'POST',
              body: JSON.stringify({ name: model }),
              headers: { 'Content-Type': 'application/json' }
            });

            if (!oRes.ok) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: `Ollama error: ${oRes.statusText}` }));
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            const reader = oRes.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
            }
            res.end();
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
          }
        });
        return;
      }

      if (url.pathname === '/api/workspace' && req.method === 'GET') {
        try {
          const root = findProjectRoot(process.cwd()) || process.cwd();
          let fileList: Array<{ name: string; isDir: boolean; size?: number }> = [];
          const scan = (dir: string, base: string = '') => {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.') && entry.name !== '.opensource') continue;
              if (entry.name === 'node_modules') continue;
              const rel = join(base, entry.name);
              const full = join(dir, entry.name);
              if (entry.isDirectory()) {
                fileList.push({ name: rel.replace(/\\/g, '/'), isDir: true });
                if (rel.split(/[\\/]/).length < 3) {
                  scan(full, rel);
                }
              } else {
                let size = 0;
                try {
                  const stat = readFileSync(full);
                  size = stat.length;
                } catch {}
                fileList.push({ name: rel.replace(/\\/g, '/'), isDir: false, size });
              }
            }
          };
          scan(root);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            primaryDir: root.split(/[\\/]/).pop(),
            totalFiles: fileList.filter(f => !f.isDir).length,
            files: fileList,
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    // WebSocket server for real-time communication
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws) => {
      console.log('Client connected');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });

    // Start heartbeat
    if (this.config.gateway.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        this.runHeartbeat();
      }, this.config.gateway.heartbeatInterval * 1000);
    }

    // Start listening
    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.config.gateway.port, () => {
        console.log(`Gateway listening on http://localhost:${this.config.gateway.port}`);
        this.state.running = true;
        resolve();
      });
    });
  }

  async startDaemon(): Promise<void> {
    // Fork into background
    const { spawn } = await import('child_process');
    const child = spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();
    console.log(`Gateway started as daemon (PID: ${child.pid})`);
    process.exit(0);
  }

  private async handleMessage(ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    switch (message.type) {
      case 'prompt':
        await this.handlePrompt(ws, message);
        break;
      case 'abort':
        await this.handleAbort(ws, message);
        break;
      case 'status':
        ws.send(JSON.stringify({
          type: 'status',
          state: {
            running: this.state.running,
            activeSessions: this.state.activeSessions.length,
          },
        }));
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        }));
    }
  }

  private async handlePrompt(ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    const prompt = message.prompt as string;
    ws.send(JSON.stringify({
      type: 'thinking',
      message: 'Processing...',
    }));

    // In a full implementation, this would route to an agent
    ws.send(JSON.stringify({
      type: 'response',
      content: `Received: ${prompt}`,
    }));
  }

  private async handleAbort(_ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    const sessionId = message.sessionId as string;
    console.log(`Aborting session: ${sessionId}`);
  }

  private async runHeartbeat(): Promise<void> {
    // Periodic check: process scheduled tasks, clean up stale sessions
    console.log(`[Heartbeat] ${new Date().toISOString()} - ${this.state.activeSessions.length} active sessions`);
  }

  async stop(): Promise<void> {
    this.state.running = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    console.log('Gateway stopped');
  }
}
