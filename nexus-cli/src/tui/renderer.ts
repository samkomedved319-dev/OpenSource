// ============================================================================
// OpenSource CLI — Modern Minimalist TUI (Claude Code Style)
// Flat inline layout · In-place line rewriting · Real-time spinners
// ============================================================================

import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'readline';
import type { ToolCall, ToolResult, NexusConfig, SessionConfig } from '../types/index.js';
import type { SkillManager } from '../skills/index.js';

export interface TUIOptions {
  showToolCalls?: boolean;
  showThinking?: boolean;
  compactMode?: boolean;
  theme?: 'dark' | 'light' | 'auto';
  noColor?: boolean;
}

export type MessageType = 'info' | 'error' | 'warning' | 'success';

// ── Palette (Minimalist High-Contrast) ──────────────────────────────────────
const C = {
  banana:     chalk.hex('#FFE135'),
  bananaDim:  chalk.hex('#FFE135').dim,
  emerald:    chalk.hex('#00FFB2'),
  mint:       chalk.hex('#00D4AA'),
  violet:     chalk.hex('#8B5CF6'),
  cyan:       chalk.hex('#22D3EE'),
  amber:      chalk.hex('#F59E0B'),
  rose:       chalk.hex('#F43F5E'),
  sky:        chalk.hex('#38BDF8'),
  dim:        chalk.dim,
  bold:       chalk.bold,
  italic:     chalk.italic,
  code:       chalk.hex('#FCD34D'),
  added:      chalk.hex('#4ADE80'),
  removed:    chalk.hex('#F87171'),
  hunk:       chalk.hex('#60A5FA').dim,
};

const SYMBOLS = {
  dot: '·',
  bullet: '•',
  success: '✔',
  error: '✖',
  info: 'ℹ',
  warning: '⚠',
  arrow: '›',
  line: '│',
};

// ── Helper: Inline Markdown Formatter ───────────────────────────────────────

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, t) => C.bold(t))
    .replace(/\*([^*]+)\*/g, (_, t) => C.italic(t))
    .replace(/`([^`]+)`/g, (_, t) => C.code(t))
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, t) => C.sky(`[[${t}]]`));
}

function formatMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        // Output code block with a sleek left border
        for (const cl of codeLines) {
          out.push(`  ${C.dim(SYMBOLS.line)}  ${C.code(cl)}`);
        }
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      out.push(`\n  ${C.banana('◈')} ${C.bold(line.slice(4))}`);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(`\n  ${C.banana('◈')} ${C.bold(line.slice(3))}`);
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(`\n  ${C.banana('◈')} ${C.bold(C.italic(line.slice(2)))}`);
      continue;
    }
    if (line.match(/^---+$/)) {
      out.push(`  ${C.dim('─'.repeat(48))}`);
      continue;
    }
    if (line.match(/^[-*] /)) {
      out.push(`  ${C.banana(SYMBOLS.bullet)} ${inlineFormat(line.slice(2))}`);
      continue;
    }

    const nm = line.match(/^(\d+)\. (.*)/);
    if (nm) {
      out.push(`  ${C.banana(nm[1] + '.')} ${inlineFormat(nm[2])}`);
      continue;
    }

    if (line.trim() === '') {
      out.push('');
      continue;
    }

    out.push(`  ${inlineFormat(line)}`);
  }

  return out.join('\n');
}

function formatDiff(content: string): string {
  return content.split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('diff --git')) {
      return `  ${C.hunk(line)}`;
    }
    if (line.startsWith('+')) return `  ${C.added(line)}`;
    if (line.startsWith('-')) return `  ${C.removed(line)}`;
    return `  ${C.dim(line)}`;
  }).join('\n');
}

// ── Main TUI Renderer ────────────────────────────────────────────────────────

export class TUIRenderer {
  private options: Required<TUIOptions>;
  private _spinner: ReturnType<typeof ora> | null = null;
  private streamBuffer = '';
  private isStreaming = false;
  private currentActiveLine = '';

  constructor(options: TUIOptions = {}) {
    this.options = {
      showToolCalls: options.showToolCalls ?? true,
      showThinking:  options.showThinking  ?? true,
      compactMode:   options.compactMode   ?? false,
      theme:         options.theme         ?? 'dark',
      noColor:       options.noColor       ?? false,
    };
    if (this.options.noColor) chalk.level = 0;
  }

  private get spinner(): ReturnType<typeof ora> {
    if (!this._spinner) {
      this._spinner = ora({
        spinner: 'dots',
        color: 'yellow',
        stream: process.stdout,
      });
    }
    return this._spinner;
  }

  // ── In-place Line Rewriter ────────────────────────────────────────────────

  private writeLine(text: string, isUpdate = false): void {
    if (isUpdate && process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(text);
    } else {
      if (this.currentActiveLine && process.stdout.isTTY) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
      }
      process.stdout.write(text + '\n');
    }
    this.currentActiveLine = isUpdate ? text : '';
  }

  private clearActiveLine(): void {
    if (this.currentActiveLine && process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      this.currentActiveLine = '';
    }
  }

  printStartup(version: string, config: NexusConfig): void {
    console.log('');
    console.log(C.emerald('  ██████╗ ██████╗ ███████╗███╗   ██╗') + C.banana('███████╗ ██████╗ ██╗   ██╗██████╗  ██████╗███████╗'));
    console.log(C.emerald('  ██╔══██╗██╔══██╗██╔════╝████╗  ██║') + C.banana('██╔════╝██╔═══██╗██║   ██║██╔══██╗██╔════╝██╔════╝'));
    console.log(C.emerald('  ██║  ██║██████╔╝█████╗  ██╔██╗ ██║') + C.banana('███████╗██║   ██║██║   ██║██████╔╝██║     █████╗  '));
    console.log(C.emerald('  ██║  ██║██╔═══╝ ██╔══╝  ██║╚██╗██║') + C.banana('╚════██║██║   ██║██║   ██║██╔══██╗██║     ██╔══╝  '));
    console.log(C.emerald('  ██████╔╝██║     ███████╗██║ ╚████║') + C.banana('███████║╚██████╔╝╚██████╔╝██║  ██║╚██████╗███████╗'));
    console.log(C.emerald('  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝') + C.banana('╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚══════╝'));
    console.log('');
    console.log(`  ${C.bold(C.banana('openSource'))} ${C.dim('v' + version)}  ${C.dim('·')}  ${C.dim('Ollama: ' + config.model)}  ${C.dim('·')}  ${C.dim('Type /help for commands')}`);
    console.log('');
  }

  // ── Input & Prompt ────────────────────────────────────────────────────────

  printPrompt(): void {
    this.clearActiveLine();
    process.stdout.write(`\n  ${C.banana('You')} ${C.dim(SYMBOLS.arrow)} `);
  }

  printUserPrompt(prompt: string): void {
    this.clearActiveLine();
    console.log(`\n  ${C.banana('You')} ${C.dim(SYMBOLS.arrow)} ${C.bold(prompt)}`);
  }

  // ── Live Streaming ────────────────────────────────────────────────────────

  startStreaming(): void {
    this.stopThinking();
    this.isStreaming = true;
    this.streamBuffer = '';
    console.log('');
    process.stdout.write(`  ${C.banana('OpenSource')} ${C.dim(SYMBOLS.arrow)} `);
  }

  streamToken(token: string): void {
    this.streamBuffer += token;
    process.stdout.write(token);
  }

  endStreaming(): string {
    const full = this.streamBuffer;
    if (this.isStreaming) process.stdout.write('\n');
    this.isStreaming = false;
    this.streamBuffer = '';
    return full;
  }

  // ── Message Renderers ─────────────────────────────────────────────────────

  printAssistantMessage(content: string, thinking?: string): void {
    this.stopThinking();
    this.clearActiveLine();

    // Render thoughts if requested and available
    if (thinking && this.options.showThinking && !this.options.compactMode) {
      const thoughtLines = thinking.split('\n').filter(l => l.trim());
      if (thoughtLines.length > 0) {
        console.log(`  ${C.dim('⠏ thinking:')}`);
        for (const line of thoughtLines.slice(0, 3)) {
          console.log(`    ${C.dim(SYMBOLS.line)} ${C.dim(C.italic(line.trim()))}`);
        }
        console.log('');
      }
    }

    const isDiff = content.includes('\n+++ ') || content.includes('\n--- ') || content.startsWith('diff --git');
    
    console.log(`  ${C.banana('OpenSource')} ${C.dim(SYMBOLS.arrow)}`);
    if (isDiff) {
      console.log(formatDiff(content));
    } else {
      console.log(formatMarkdown(content));
    }
    console.log('');
  }

  printThinking(): void {
    this.stopThinking();
    this.spinner.text = C.dim('thinking...');
    this.spinner.start();
  }

  stopThinking(): void {
    if (this.spinner.isSpinning) {
      this.spinner.stop();
      this.clearActiveLine();
    }
  }

  printMessage(text: string, type: MessageType = 'info'): void {
    this.clearActiveLine();
    const symbols: Record<MessageType, string> = {
      info: C.sky(SYMBOLS.info),
      error: C.rose(SYMBOLS.error),
      warning: C.amber(SYMBOLS.warning),
      success: C.emerald(SYMBOLS.success),
    };
    const colors: Record<MessageType, typeof chalk.green> = {
      info: C.sky,
      error: C.rose,
      warning: C.amber,
      success: C.emerald,
    };
    console.log(`  ${symbols[type]} ${colors[type](text)}`);
  }

  printError(message: string): void {
    this.stopThinking();
    this.clearActiveLine();
    console.log(`  ${C.rose(SYMBOLS.error)} ${C.rose(message)}`);
  }

  // ── Tool Execution (Claude Style Spinner updates) ──────────────────────────

  printToolCall(toolCall: ToolCall): void {
    if (!this.options.showToolCalls) return;
    this.stopThinking();
    this.clearActiveLine();

    // Pretty preview of input args
    const args = JSON.stringify(toolCall.input);
    const details = args.length > 50 ? args.slice(0, 48) + '...' : args;

    // Start inline spinner for the active tool
    this.spinner.text = `${C.dim('Running')} ${C.banana(toolCall.name)} ${C.dim(details)}...`;
    this.spinner.start();
  }

  printToolResults(results: ToolResult[]): void {
    this.stopThinking();
    if (!this.options.showToolCalls) return;

    for (const r of results) {
      this.clearActiveLine();
      if (r.isError) {
        const cleanErr = r.content.replace(/\n/g, ' ');
        const preview = cleanErr.length > 60 ? cleanErr.slice(0, 58) + '...' : cleanErr;
        console.log(`  ${C.rose(SYMBOLS.error)} ${C.dim('Failed:')} ${C.rose(preview)}`);
      } else {
        const cleanContent = r.content.replace(/\n/g, ' ');
        const preview = cleanContent.length > 60 ? cleanContent.slice(0, 58) + '...' : cleanContent;
        console.log(`  ${C.emerald(SYMBOLS.success)} ${C.dim('Completed:')} ${C.italic(C.dim(preview))}`);
      }
    }
  }

  // ── Interactive Approvals ─────────────────────────────────────────────────

  async requestApproval(toolCall: ToolCall): Promise<boolean> {
    this.stopThinking();
    this.clearActiveLine();

    console.log(`\n  ${C.amber(SYMBOLS.warning)} ${C.bold('Action approval needed')}`);
    console.log(`    ${C.dim(SYMBOLS.line)} tool:   ${C.banana(toolCall.name)}`);
    console.log(`    ${C.dim(SYMBOLS.line)} params: ${C.dim(JSON.stringify(toolCall.input))}\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => {
      rl.question(`  ${C.bold('  Approve action?')} ${C.dim('(y/n/always): ')}`, a => {
        rl.close();
        const ans = a.trim().toLowerCase();
        console.log('');
        res(ans === 'y' || ans === 'always' || ans === 'a');
      });
    });
  }

  async requestPlanApproval(): Promise<boolean> {
    this.clearActiveLine();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => {
      rl.question(`\n    ${C.banana('Execute plan?')} ${C.dim('(y/N): ')}`, a => {
        rl.close();
        res(a.trim().toLowerCase() === 'y');
      });
    });
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  printPlan(content: string): void {
    this.clearActiveLine();
    console.log(`\n  ${C.banana('Plan Execution Steps:')}`);
    for (const line of content.split('\n')) {
      const m = line.match(/^(\d+)[.)]\s+(.*)/);
      if (m) {
        console.log(`    ${C.banana(m[1] + '.')} ${inlineFormat(m[2])}`);
      } else if (line.trim()) {
        console.log(`    ${C.dim(line)}`);
      }
    }
  }

  // ── Specialized Lists & Tables ────────────────────────────────────────────

  printToolList(tools: Array<{ name: string; description: string; category: string }>): void {
    this.clearActiveLine();
    const byCat = new Map<string, typeof tools>();
    for (const t of tools) {
      const list = byCat.get(t.category) || [];
      list.push(t);
      byCat.set(t.category, list);
    }

    console.log('');
    for (const [cat, items] of byCat) {
      console.log(`  ${C.bold(C.banana(cat.toUpperCase()))}`);
      for (const t of items) {
        console.log(`    ${C.banana(SYMBOLS.bullet)} ${C.bold(t.name.padEnd(24))} ${C.dim(t.description)}`);
      }
    }
    console.log('');
  }

  async printSkillList(skillManager: SkillManager): Promise<void> {
    this.clearActiveLine();
    const skills = skillManager.listSkills();
    if (skills.length === 0) {
      this.printMessage('No skills configured', 'info');
      return;
    }
    console.log('');
    for (const s of skills) {
      console.log(`  ${C.banana(SYMBOLS.bullet)} ${C.bold(s.name)} ${C.dim('v' + s.version + ' — ' + s.description)}`);
    }
    console.log('');
  }

  async printMemory(layers: Record<string, string>): Promise<void> {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('Active Memory Layers'))}`);
    for (const [name, content] of Object.entries(layers)) {
      const clean = content.replace(/\n/g, ' ');
      const preview = clean.length > 58 ? clean.slice(0, 56) + '...' : clean;
      console.log(`    ${C.banana(SYMBOLS.bullet)} ${C.bold(name.padEnd(16))} ${C.dim(preview)}`);
    }
    console.log('');
  }

  printSessionList(sessions: SessionConfig[]): void {
    this.clearActiveLine();
    if (sessions.length === 0) {
      this.printMessage('No recent sessions', 'info');
      return;
    }
    console.log(`\n  ${C.bold(C.banana('Recent Sessions'))}`);
    for (const s of sessions.slice(0, 10)) {
      console.log(`    ${C.dim(SYMBOLS.bullet)} ${C.banana(s.id.slice(0, 8))}   ${C.dim(s.model.padEnd(18))} ${C.dim(s.updatedAt.toLocaleDateString())}`);
    }
    console.log('');
  }

  printAgentList(config: NexusConfig): void {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('Available Agent Run Profiles'))}`);
    const badge = config.provider === 'ollama' ? C.emerald('LOCAL') : C.violet('CLOUD');
    console.log(`    ${C.banana(SYMBOLS.bullet)} ${C.bold('main')} [${badge}]  ${C.dim(config.provider + '/' + config.model)}`);
    console.log('');
  }

  printVaultSummary(vaultPath: string, noteCount: number, tags: string[]): void {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('Obsidian Knowledge Vault'))}`);
    console.log(`    ${C.dim(SYMBOLS.line)} Path:  ${C.sky(vaultPath)}`);
    console.log(`    ${C.dim(SYMBOLS.line)} Notes: ${C.banana(String(noteCount))} files indexed`);
    if (tags.length) {
      console.log(`    ${C.dim(SYMBOLS.line)} Tags:  ${tags.slice(0, 8).map(t => C.cyan('#' + t)).join(', ')}${tags.length > 8 ? C.dim(' (+' + (tags.length - 8) + ' more)') : ''}`);
    }
    console.log('');
  }

  // ── Doctor / Diagnostic System ────────────────────────────────────────────

  printDoctor(config: NexusConfig): void {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('OpenSource CLI Doctor Diagnostics'))}`);
    const checks = [
      { name: 'Provider', ok: true, val: config.provider },
      { name: 'Model', ok: true, val: config.model },
      { name: 'Memory', ok: config.memory.enabled, val: config.memory.enabled ? 'Enabled' : 'Disabled' },
      { name: 'Skills', ok: config.skills.enabled, val: config.skills.enabled ? 'Enabled' : 'Disabled' },
      { name: 'Obsidian', ok: !!config.obsidian?.vaultPath, val: config.obsidian?.vaultPath || 'Not configured' },
      { name: 'MCP API', ok: config.mcp.enabled, val: config.mcp.enabled ? 'Enabled' : 'Disabled' },
      { name: 'Hooks', ok: config.hooks.enabled, val: config.hooks.enabled ? 'Enabled' : 'Disabled' },
    ];
    for (const c of checks) {
      const symbol = c.ok ? C.emerald(SYMBOLS.success) : C.amber(SYMBOLS.warning);
      console.log(`    ${symbol}  ${c.name.padEnd(12)} ${C.dim(c.val)}`);
    }
    console.log('');
  }

  printDashboard(config: NexusConfig, sessions: SessionConfig[]): void {
    this.printStartup('1.1.0', config);
    this.printSessionList(sessions);
  }

  // ── Help Commands (Flat Table Layout) ─────────────────────────────────────

  printHelp(): void {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('Active Slash Commands'))}`);
    const cmds: [string, string][] = [
      ['/help', 'Display this list of console commands'],
      ['/clear', 'Clear active context layers'],
      ['/plan <goal>', 'Design and execute a programmatic plan'],
      ['/tools', 'List all loaded system tools'],
      ['/skills', 'Show available custom agent skill bundles'],
      ['/memory', 'Print loaded memory layers'],
      ['/model <name>', 'Change target model live'],
      ['/capabilities', 'Explore full software engineering capability suite'],
      ['/vault', 'Review connected Obsidian Vault settings'],
      ['/notes <query>', 'Query your Obsidian knowledge base'],
      ['/think', 'Toggle detailed model thinking stream'],
      ['/status', 'Show current system configuration'],
      ['/doctor', 'Run doctor diagnostics check'],
      ['/add <file>', 'Load a specific file into conversational context'],
      ['/commit [msg]', 'Generate AI commit message and commit changes'],
      ['/sessions', 'List history logs and sessions'],
      ['/agents', 'Show active agent orchestrator'],
      ['/exit', 'Close CLI agent session'],
    ];
    for (const [cmd, desc] of cmds) {
      console.log(`    ${C.banana(cmd.padEnd(16))} ${C.dim(desc)}`);
    }
    console.log('');
  }

  printCapabilities(): void {
    this.clearActiveLine();
    console.log(`\n  ${C.bold(C.banana('openSource Developer Agent Capabilities'))}`);
    
    const categories = [
      {
        title: 'Core Coding & Refactoring',
        items: ['Code Generation & Autocomplete', 'Language & Coder Switcher', 'Semantic Code Refactoring', 'Automated Bug Detection & Fixes']
      },
      {
        title: 'Testing & Quality Assurance',
        items: ['Unit, Integration, & E2E Testing', 'Mock & Fixture Generation', 'Test Coverage & Minimization', 'Visual Regression Checks']
      },
      {
        title: 'DevOps & Infrastructure-as-Code',
        items: ['CI/CD Pipeline Automation', 'Docker & Helm Deployments', 'Terraform & Pulumi Templates', 'Cloud Provisioning (AWS/Azure/GCP)']
      },
      {
        title: 'Security & Vulnerability Audits',
        items: ['OWASP Compliance & Secret Auditing', 'Threat Modeling & Surface Analysis', 'Authentication Flow Audits', 'Vulnerability Patch Automation']
      },
      {
        title: 'Database & API Architecture',
        items: ['SQL & NoSQL Query Optimization', 'ORM & Schema Migration Generation', 'REST & GraphQL Design', 'Microservice Cache & Scalability']
      },
      {
        title: 'UI/UX & Frontend Optimization',
        items: ['Responsive Web Components', 'CSS & Tailwind Generation', 'SEO & Accessibility Compliance', 'Performance Latency Analysis']
      }
    ];

    for (const cat of categories) {
      console.log(`\n    ${C.bold(C.banana(cat.title))}`);
      for (const item of cat.items) {
        console.log(`      ${C.banana(SYMBOLS.bullet)} ${C.dim(item)}`);
      }
    }
    console.log('');
  }
}
