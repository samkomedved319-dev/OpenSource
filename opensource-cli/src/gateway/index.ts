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

    this.httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'running',
          uptime: Date.now() - this.state.startTime.getTime(),
          activeSessions: this.state.activeSessions.length,
        }));
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
