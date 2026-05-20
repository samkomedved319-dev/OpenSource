#!/usr/bin/env node
// ============================================================================
// OpenSource CLI — Entry Point
// Local-First AI Coding Agent · Obsidian Vault · No API Keys Required
// ============================================================================

import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Core modules
import { OpenSourceAgent } from './core/agent.js';
import { loadConfig, findProjectRoot } from './config/index.js';
import { ToolRegistry } from './tools/registry.js';
import { MemorySystem } from './memory/index.js';
import { SkillManager } from './skills/index.js';
import { MCPServerManager } from './mcp/index.js';
import { HookManager } from './hooks/index.js';
import { Gateway } from './gateway/index.js';
import { SessionManager } from './sessions/index.js';
import { TUIRenderer } from './tui/renderer.js';
import { scanWorkspace, initEmptyProject } from './utils/workspace.js';
import type { NexusConfig as NexusConfigType } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

// ── CLI Setup ─────────────────────────────────────────────────────────────────

program
  .name('opensource')
  .description(chalk.bold('OpenSource CLI') + ' — Local-First AI Coding Agent')
  .version(pkg.version)
  .helpOption('-h, --help', 'Show help')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.dim('$')} opensource                              ${chalk.dim('# Interactive REPL')}
  ${chalk.dim('$')} opensource "Refactor auth module"       ${chalk.dim('# One-shot query')}
  ${chalk.dim('$')} opensource --plan "Add auth system"     ${chalk.dim('# Plan before executing')}
  ${chalk.dim('$')} opensource --auto "fix all lint errors" ${chalk.dim('# Auto-approve tools')}
  ${chalk.dim('$')} opensource -m qwen2.5-coder            ${chalk.dim('# Use specific model')}
  ${chalk.dim('$')} opensource --vault ~/Notes "explain"   ${chalk.dim('# Use specific vault')}
  ${chalk.dim('$')} opensource notes "architecture"         ${chalk.dim('# Search vault notes')}
  ${chalk.dim('$')} opensource doctor                       ${chalk.dim('# Check configuration')}
  ${chalk.dim('$')} opensource dashboard                    ${chalk.dim('# Session overview')}
  ${chalk.dim('$')} opensource gateway                      ${chalk.dim('# Run as daemon')}

${chalk.bold('Aliases:')} ${chalk.dim('opensource, os')}
`);

// ── Shared Init ───────────────────────────────────────────────────────────────

async function initSystems(options: Record<string, unknown>) {
  const workdir = String(options.workdir || process.cwd());
  const projectRoot = findProjectRoot(workdir) || workdir;
  const vaultPath = options.vault ? String(options.vault) : undefined;
  const config = await loadConfig(projectRoot, { vaultPath });

  if (options.model) config.model = String(options.model);
  if (options.provider) config.provider = String(options.provider) as NexusConfigType['provider'];
  if (options.plan) config.agent.planningMode = 'always';
  if (options.auto) config.agent.autoApprove = ['*'];

  const tui = new TUIRenderer({
    showToolCalls: true,
    showThinking: true,
    compactMode: !!options.compact,
    noColor: options.tui === false,
    theme: 'dark',
  });

  const toolRegistry = new ToolRegistry(config);
  const memorySystem = new MemorySystem(config);
  const skillManager = new SkillManager(config);
  const mcpManager = new MCPServerManager(config);
  const hookManager = new HookManager(config);
  const sessionManager = new SessionManager(config);

  await toolRegistry.registerDefaults();

  if (config.mcp.enabled) {
    await mcpManager.initialize();
    const mcpTools = await mcpManager.discoverTools();
    toolRegistry.registerMCPTools(mcpTools);
  }

  if (config.skills.enabled) await skillManager.discoverSkills();
  if (config.memory.enabled) await memorySystem.initialize(projectRoot);
  if (config.hooks.enabled) await hookManager.loadHooks();

  const sessionId = options.session
    ? String(options.session)
    : sessionManager.createSession(workdir);

  const agent = new OpenSourceAgent(
    {
      id: String(options.agent || 'main'),
      name: String(options.agent || 'main'),
      model: config.model,
      provider: config.provider,
      maxIterations: config.agent.maxIterations,
      memoryEnabled: config.memory.enabled,
      skillsEnabled: config.skills.enabled,
    },
    { config, toolRegistry, memorySystem, skillManager, mcpManager, hookManager, sessionManager, tui, workdir, sessionId }
  );

  return { config, tui, agent, workdir };
}

// ── Main Interactive Command ──────────────────────────────────────────────────

program
  .argument('[prompt]', 'Initial prompt or question')
  .option('-w, --workdir <dir>', 'Working directory', process.cwd())
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'LLM provider')
  .option('--vault <path>', 'Obsidian vault path (overrides config)')
  .option('--plan', 'Show plan before executing')
  .option('--auto', 'Auto-approve all tool calls')
  .option('--verbose', 'Show verbose output')
  .option('--compact', 'Use compact TUI mode')
  .option('--no-tui', 'Disable rich TUI output')
  .option('--no-scan', 'Disable workspace structure scan on startup')
  .option('--agent <agent>', 'Agent to use', 'main')
  .option('--session <session>', 'Resume existing session')
  .action(async (prompt: string | undefined, options: Record<string, unknown>) => {

    try {
      const { config, tui, agent, workdir } = await initSystems(options);
      
      // Dynamic Workspace Ingestion Scan
      let scan = scanWorkspace(workdir);
      
      if (scan.isEmpty) {
        tui.printMessage(`Empty directory detected at: ${workdir}`, 'warning');
        console.log(chalk.dim('\n  Would you like to initialize a new Node/TypeScript project skeleton?'));
        
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const approved = await new Promise<boolean>(res => {
          rl.question(`    ${chalk.bold('Initialize project?')} ${chalk.dim('(Y/n): ')}`, a => {
            rl.close();
            const ans = a.trim().toLowerCase();
            res(ans === '' || ans === 'y' || ans === 'yes');
          });
        });
        
        if (approved) {
          initEmptyProject(workdir);
          tui.printMessage('Successfully initialized project skeleton!', 'success');
          console.log(chalk.dim('    Created package.json, index.js, README.md, .gitignore, OPENSOURCE.md\n'));
          // Re-scan after init
          scan = scanWorkspace(workdir);
        } else {
          tui.printMessage('Skipping project initialization.', 'info');
        }
      }

      tui.printStartup(pkg.version, config);

      // Print visual workspace representation
      if (options.scan !== false && config.tui.showWorkspaceTree !== false) {
        console.log(`  ${chalk.hex('#FFE135')('◈')} ${chalk.bold('Detected Workspace Structure:')}`);
        console.log(scan.treeString.split('\n').map(line => `    ${chalk.dim(line)}`).join('\n') + '\n');
      }

      if (prompt) {
        await agent.run(prompt);
        process.exit(0);
      } else {
        await agent.startREPL();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const tui = new TUIRenderer({});
      tui.printError(msg);

      const errLower = msg.toLowerCase();
      if (errLower.includes('connect') || errLower.includes('econnrefused')) {
        console.log(chalk.dim('  → try: ollama serve'));
      }
      if (options.verbose) console.error(error);
      process.exit(1);
    }
  });

// ── Notes Command (quick vault search) ───────────────────────────────────────

program
  .command('notes [query]')
  .description('Search your Obsidian vault notes')
  .option('--vault <path>', 'Vault path (overrides config)')
  .option('--tag <tag>', 'Filter by tag')
  .action(async (query: string | undefined, options: Record<string, unknown>) => {
    const workdir = process.cwd();
    const vaultPath = options.vault ? String(options.vault) : undefined;
    const config = await loadConfig(workdir, { vaultPath });
    const tui = new TUIRenderer({});

    if (!config.obsidian?.vaultPath) {
      tui.printError('No Obsidian vault configured.');
      console.log(chalk.dim('  Set OBSIDIAN_VAULT env var or obsidian.vaultPath in .opensource/opensource.json'));
      process.exit(1);
    }

    if (!query) {
      // Show vault summary
      const { readdirSync, readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      let noteCount = 0;
      const tags = new Set<string>();
      function walk(dir: string) {
        try {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith('.')) continue;
            if (e.isDirectory()) walk(join(dir, e.name));
            else if (e.name.endsWith('.md')) {
              noteCount++;
              try {
                const c = readFileSync(join(dir, e.name), 'utf-8');
                (c.match(/#(\w+)/g) || []).forEach(t => tags.add(t.slice(1)));
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
      if (existsSync(config.obsidian.vaultPath)) {
        walk(config.obsidian.vaultPath);
        tui.printVaultSummary(config.obsidian.vaultPath, noteCount, [...tags]);
      }
    } else {
      // Use agent to search
      const toolRegistry = new ToolRegistry(config);
      await toolRegistry.registerDefaults();
      const { v4: uuidv4 } = await import('uuid');
      const result = await toolRegistry.executeTool(
        { id: uuidv4(), name: 'obsidian_search_notes', input: { query, tag: options.tag, maxResults: 10 } },
        { workdir, sessionId: 'cli', agentId: 'cli' }
      );
      console.log(result.content);
    }
  });

// ── Vault Command (interactive vault explorer) ────────────────────────────────

program
  .command('vault [query]')
  .description('Browse and search your Obsidian vault')
  .option('--vault <path>', 'Vault path (overrides config)')
  .option('--read <title>', 'Read a specific note by title')
  .option('--graph', 'Show vault graph statistics')
  .action(async (query: string | undefined, options: Record<string, unknown>) => {
    const workdir = process.cwd();
    const vaultPath = options.vault ? String(options.vault) : undefined;
    const config = await loadConfig(workdir, { vaultPath });
    const tui = new TUIRenderer({});

    if (!config.obsidian?.vaultPath) {
      tui.printError('No Obsidian vault configured.');
      console.log(chalk.dim('  Set OBSIDIAN_VAULT=<path> or add obsidian.vaultPath to .opensource/opensource.json'));
      process.exit(1);
    }

    const toolRegistry = new ToolRegistry(config);
    await toolRegistry.registerDefaults();
    const { v4: uuidv4 } = await import('uuid');
    const ctx = { workdir, sessionId: 'cli', agentId: 'cli' };

    if (options.graph) {
      const r = await toolRegistry.executeTool(
        { id: uuidv4(), name: 'obsidian_graph', input: {} }, ctx
      );
      console.log(r.content);
    } else if (options.read) {
      const r = await toolRegistry.executeTool(
        { id: uuidv4(), name: 'obsidian_read_note', input: { title: String(options.read) } }, ctx
      );
      console.log(r.content);
    } else if (query) {
      const r = await toolRegistry.executeTool(
        { id: uuidv4(), name: 'obsidian_search_notes', input: { query, maxResults: 10 } }, ctx
      );
      console.log(r.content);
    } else {
      // Show summary
      const { readdirSync, readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      let noteCount = 0;
      const tags = new Set<string>();
      function walk(dir: string) {
        try {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith('.')) continue;
            if (e.isDirectory()) walk(join(dir, e.name));
            else if (e.name.endsWith('.md')) {
              noteCount++;
              try {
                (readFileSync(join(dir, e.name), 'utf-8').match(/#(\w+)/g) || []).forEach(t => tags.add(t.slice(1)));
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
      if (existsSync(config.obsidian.vaultPath)) {
        walk(config.obsidian.vaultPath);
        tui.printVaultSummary(config.obsidian.vaultPath, noteCount, [...tags]);
        console.log(chalk.dim('\n  Usage: opensource vault <query>  |  --read <title>  |  --graph'));
      }
    }
  });

// ── Dashboard Command ─────────────────────────────────────────────────────────

program
  .command('dashboard')
  .description('Show OpenSource CLI dashboard with session overview')
  .action(async () => {
    const config = await loadConfig(process.cwd());
    const tui = new TUIRenderer({});
    const sessionManager = new SessionManager(config);
    tui.printDashboard(config, sessionManager.listSessions());
  });

// ── Gateway Command ───────────────────────────────────────────────────────────

program
  .command('gateway')
  .description('Start OpenSource CLI in gateway/daemon mode')
  .option('-p, --port <port>', 'Gateway port', '3100')
  .option('--host <host>', 'Gateway host', 'localhost')
  .option('--heartbeat <interval>', 'Heartbeat interval in seconds', '1800')
  .option('--agents <count>', 'Max concurrent agents', '5')
  .option('-d, --detach', 'Run as background daemon')
  .action(async (options) => {
    const config = await loadConfig(process.cwd());
    const gateway = new Gateway({
      ...config,
      gateway: {
        ...config.gateway,
        port: Number(options.port),
        heartbeatInterval: Number(options.heartbeat),
        enabled: true,
      },
    });
    if (options.detach) await gateway.startDaemon();
    else await gateway.start();
  });

// ── Agent Commands ────────────────────────────────────────────────────────────

program
  .command('agents')
  .description('Manage agents')
  .addCommand(
    new Command('list')
      .description('List all agents')
      .action(async () => {
        const config = await loadConfig(process.cwd());
        new TUIRenderer({}).printAgentList(config);
      })
  );

// ── Skills Commands ───────────────────────────────────────────────────────────

program
  .command('skills')
  .description('Manage skills')
  .addCommand(
    new Command('list')
      .description('List all available skills')
      .action(async () => {
        const config = await loadConfig(process.cwd());
        const skillManager = new SkillManager(config);
        await skillManager.discoverSkills();
        await new TUIRenderer({}).printSkillList(skillManager);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new skill')
      .argument('<name>', 'Skill name')
      .action(async (name) => {
        const config = await loadConfig(process.cwd());
        const skillManager = new SkillManager(config);
        await skillManager.createSkill(name);
        new TUIRenderer({}).printMessage(`Skill "${name}" created`, 'success');
      })
  );

// ── Memory Commands ───────────────────────────────────────────────────────────

program
  .command('memory')
  .description('Manage memory')
  .addCommand(
    new Command('show')
      .description('Show current memory')
      .action(async () => {
        const config = await loadConfig(process.cwd());
        const memory = new MemorySystem(config);
        await memory.initialize(process.cwd());
        await new TUIRenderer({}).printMemory(await memory.getAllLayers(process.cwd()));
      })
  )
  .addCommand(
    new Command('clear')
      .description('Clear learned memory')
      .action(async () => {
        const config = await loadConfig(process.cwd());
        const memory = new MemorySystem(config);
        await memory.clearLearned(process.cwd());
        new TUIRenderer({}).printMessage('Learned memory cleared', 'success');
      })
  );

// ── Session Commands ──────────────────────────────────────────────────────────

program
  .command('sessions')
  .description('Manage sessions')
  .addCommand(
    new Command('list')
      .description('List all sessions')
      .action(async () => {
        const config = await loadConfig(process.cwd());
        const sessionManager = new SessionManager(config);
        new TUIRenderer({}).printSessionList(sessionManager.listSessions());
      })
  );

// ── Init & Doctor ─────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize OpenSource CLI in current project')
  .option('--force', 'Overwrite existing config')
  .action(async (options) => {
    await loadConfig(process.cwd(), { createIfMissing: true, force: options.force });
    const tui = new TUIRenderer({});
    tui.printMessage('OpenSource CLI initialized', 'success');
    console.log(chalk.dim('  Edit OPENSOURCE.md for project instructions'));
    console.log(chalk.dim('  Edit .opensource/ai.md to customize AI persona'));
  });

program
  .command('doctor')
  .description('Check OpenSource CLI configuration and environment')
  .action(async () => {
    const tui = new TUIRenderer({});
    const config = await loadConfig(process.cwd());
    tui.printDoctor(config);

    // Live Ollama check
    if (config.provider === 'ollama') {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json() as { models?: Array<{ name: string }> };
          const models = (data.models || []).map(m => m.name);
          console.log(`  ${chalk.hex('#00FFB2')('✓')} ollama ${chalk.dim(`reachable — ${models.length} model(s)`)}`);
          if (models.length > 0) {
            console.log(`    ${chalk.dim('available: ' + models.slice(0, 5).join(', ') + (models.length > 5 ? ` +${models.length - 5} more` : ''))}`);
          }
        } else {
          console.log(`  ${chalk.yellow('○')} ollama ${chalk.dim(`responded ${res.status}`)}`);
        }
      } catch {
        console.log(`  ${chalk.red('✗')} ollama ${chalk.dim('not reachable — run: ollama serve')}`);
      }
    }
  });

// ── AI Persona Command ────────────────────────────────────────────────────────

program
  .command('ai')
  .description('Show or edit the AI persona configuration')
  .action(async () => {
    const config = await loadConfig(process.cwd()) as unknown as Record<string, unknown> & { _aiPersona?: string };
    const tui = new TUIRenderer({});
    if (config._aiPersona) {
      console.log(chalk.dim('\n  AI persona loaded from .opensource/ai.md\n'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(config._aiPersona);
      console.log(chalk.dim('─'.repeat(60)));
    } else {
      tui.printMessage('No AI persona configured.', 'info');
      console.log(chalk.dim('  Create .opensource/ai.md or run: opensource init'));
    }
  });

// ── Run ───────────────────────────────────────────────────────────────────────

program.parse(process.argv);
