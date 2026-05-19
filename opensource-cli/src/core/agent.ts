// ============================================================================
// OpenSource CLI — Core Agent Loop
// Plan → Execute → Observe → Learn
// Strong AI identity · Streaming output · Vault-aware
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import type {
  Message, ToolCall, ToolResult, AgentConfig, Plan, PlanStep, LLMResponse, NexusEvent,
} from '../types/index.js';
import type { NexusConfig } from '../types/index.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { MemorySystem } from '../memory/index.js';
import type { SkillManager } from '../skills/index.js';
import type { MCPServerManager } from '../mcp/index.js';
import type { HookManager } from '../hooks/index.js';
import type { SessionManager } from '../sessions/index.js';
import type { TUIRenderer } from '../tui/renderer.js';
import { LLMProvider } from './llm.js';

export interface AgentDeps {
  config: NexusConfig;
  toolRegistry: ToolRegistry;
  memorySystem: MemorySystem;
  skillManager: SkillManager;
  mcpManager: MCPServerManager;
  hookManager: HookManager;
  sessionManager: SessionManager;
  tui: TUIRenderer;
  workdir: string;
  sessionId: string;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildCoreIdentity(): string {
  return `# OpenSource CLI — AI Coding Agent

You are **OpenSource**, an elite, local-first AI coding agent embedded directly in the developer's terminal. You are a senior software engineer and architect with mastery across all major languages, frameworks, runtimes, and system architectures.

## Identity & Philosophy

- **LOCAL-FIRST**: You run entirely on the user's machine via Ollama. No cloud dependencies required. You prioritize local tools, files, and their Obsidian knowledge base.
- **CRAFTSMAN MINDSET**: You write clean, idiomatic, production-grade code. You don't cut corners. You understand existing code before touching it.
- **PRECISION**: Answer with surgical accuracy. No filler, no hedging, no unnecessary apologies. Get to the point.
- **OBSIDIAN-AWARE**: The user's Obsidian vault is your extended memory. Before making architectural decisions, consult it. After solving complex problems, offer to save insights there.
- **SAFETY**: Never make destructive changes without explicit user confirmation. Always show what will change before changing it.
- **CONTINUOUS LEARNING**: When you recognize a reusable pattern, suggest creating a skill. When you discover project conventions, remember them.

## Core Behavior Rules

1. **READ BEFORE WRITE** — Always read existing code/files before modifying them.
2. **ONE TOOL PER STEP** — Execute tools sequentially, verify each result before the next.
3. **SHOW DIFFS** — For file edits, show the full diff in \`\`\`diff blocks before applying.
4. **VERIFY CHANGES** — After code changes, run tests or build to confirm success.
5. **CONCISE RESPONSES** — Keep prose minimal. Code speaks louder. No summaries, no sign-offs.
6. **VAULT FIRST** — For architecture decisions, search Obsidian first: \`obsidian_search_notes\`.
7. **TEXT ONLY** — You cannot read images, PDFs, or binary files. Reject such requests gracefully.

## Tool Philosophy

Use the right tool for the job:
- \`read_file\` / \`write_file\` / \`edit_file\` — for file operations
- \`search_files\` — to discover relevant code before editing  
- \`shell\` — for builds, tests, git, package managers
- \`obsidian_*\` — to read/write/search the knowledge vault
- \`web_search\` / \`web_fetch\` — for external documentation only when local knowledge fails

## Obsidian Vault Integration

The user's Obsidian vault is their personal knowledge base — treat it as sacred. When you use it:
- Search before answering architecture questions
- Reference specific notes when they're relevant
- Offer to create notes for important discoveries
- Use wikilinks [[like this]] when referencing vault concepts

## Capabilities & Feature Matrix

You possess comprehensive autonomous engineering capabilities across the entire software development lifecycle (SDLC). Approach all user requests with domain authority, adhering to these pillars:

1. **Core Coding Abilities**:
   - **Code Generation**: Write clean, production-grade applications, APIs, UI components, backend microservices, DB schemas, IaC, automation scripts, and test files from natural language specifications.
   - **Autocomplete & Boilerplate**: Offer predicted coding blocks, context-aware whole-function autocompletes, auto-import optimizations, and pattern expansions.
   - **Refactoring**: Safely rename classes/variables, extract modules/interfaces, remove dead/duplicate code, and modernize frameworks or languages.
   - **Bug Fixing**: Detect, diagnose, and auto-repair syntax/runtime errors, logical flaws, stack trace exceptions, infinite loops, and concurrency bottlenecks.

2. **Debugging & Technical Analysis**:
   - **Intelligent Debugging**: Trace states, interpret stack runs, analyze variable flows, and audit bottlenecks.
   - **Static & Runtime Analysis**: Audit circular dependencies, unused packages, complexity thresholds, type constraints, memory leaks, and CPU/event-loop latency bottlenecks.

3. **DevOps & Infrastructure**:
   - **CI/CD Pipelines**: Write config files for GitHub Actions, GitLab CI, Azure DevOps, and Jenkins.
   - **Cloud Provisioning**: Provide optimal Terraform/Pulumi setups for AWS, GCP, and Azure.
   - **Environment Management**: Dockerize apps, generate Helm charts, manage secrets, and configure local container orchestrations.

4. **Security & Vulnerability Auditing**:
   - OWASP compliance tracking, API key leakage detection, secret scans, authorization audits, threat modeling, and automated security patch suggestions.

5. **Microservices & Database Modeling**:
   - Normalization, index optimizations, ETL pipeline scripting, and ORM model mapping.

6. **Frontend & UX Engineering**:
   - Generate fully responsive components, interactive charts/dashboards, CSS animations, SEO meta setups, and accessibility audits.

Always deliver fully complete, highly structured, well-commented, and tested implementations. Do not use placeholders.`;
}

// ── Agent Class ───────────────────────────────────────────────────────────────

export class OpenSourceAgent {
  private config: AgentConfig;
  private deps: AgentDeps;
  private llm: LLMProvider;
  private messages: Message[] = [];
  private iterationCount = 0;
  private isRunning = false;
  private currentPlan: Plan | null = null;
  private abortController: AbortController | null = null;
  private cachedToolDescriptions: string | null = null;
  private showThinking = true;

  constructor(config: AgentConfig, deps: AgentDeps) {
    this.config = config;
    this.deps = deps;
    this.llm = new LLMProvider(config, deps.config);
  }

  // ── Main Entry ────────────────────────────────────────────────────────────

  async run(prompt: string): Promise<string> {
    this.abortController = new AbortController();
    this.isRunning = true;
    this.iterationCount = 0;

    this.deps.tui.printUserPrompt(prompt);
    this.messages.push({
      id: uuidv4(), role: 'user', content: prompt, timestamp: new Date(),
    });

    await this.loadContext();

    let result = '';
    while (this.isRunning && this.iterationCount < this.config.maxIterations!) {
      this.iterationCount++;

      this.emit({ type: 'message:send', sessionId: this.deps.sessionId, timestamp: new Date() });

      if (this.abortController.signal.aborted) break;

      const response = await this.callLLM();

      if (response.content) {
        result = response.content;
        this.deps.tui.printAssistantMessage(response.content, this.showThinking ? response.thinking : undefined);
      }

      if (response.toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(response.toolCalls);

        this.messages.push({
          id: uuidv4(), role: 'assistant', content: response.content || '', timestamp: new Date(),
        });

        for (const tr of toolResults) {
          this.messages.push({
            id: uuidv4(), role: 'tool', content: tr.content, timestamp: new Date(),
            toolCallId: tr.toolCallId,
            toolName: response.toolCalls.find(tc => tc.id === tr.toolCallId)?.name,
          });
        }

        this.deps.tui.printToolResults(toolResults);
      } else {
        if (!response.content) break;
        this.messages.push({
          id: uuidv4(), role: 'assistant', content: response.content, timestamp: new Date(),
        });
        break;
      }

      if (response.stopReason === 'end_turn' || response.stopReason === 'stop_sequence') break;
    }

    // Persist
    if (this.deps.config.memory.enabled) {
      await this.deps.memorySystem.saveConversation(this.deps.sessionId, this.messages);
    }
    if (this.deps.config.skills.enabled && this.deps.config.skills.autoCreate) {
      await this.deps.skillManager.tryCreateSkill(this.messages, this.deps.workdir);
    }

    this.isRunning = false;
    this.emit({ type: 'session:end', sessionId: this.deps.sessionId, timestamp: new Date() });

    return result;
  }

  // ── REPL Mode ─────────────────────────────────────────────────────────────

  async startREPL(): Promise<void> {
    const readline = await import('readline');
    const completions = [
      '/help', '/clear', '/plan', '/tools', '/skills', '/memory', 
      '/model', '/vault', '/notes', '/think', '/sessions', '/agents',
      '/doctor', '/status', '/add', '/commit', '/exit'
    ];

    const completer = (line: string) => {
      const hits = completions.filter((c) => c.startsWith(line.trim()));
      
      // If there are multiple hits, show a clean suggestion panel
      if (hits.length > 1 && process.stdout.isTTY) {
        console.log(`\n\n  ${chalk.bold(chalk.hex('#FFE135')('Suggestions:'))}`);
        for (const h of hits) {
          const desc = this.getCommandDescription(h);
          console.log(`    ${chalk.hex('#FFE135')('•')} ${chalk.bold(h.padEnd(16))} ${chalk.dim(desc)}`);
        }
        console.log('');
      }

      return [hits.length ? hits : completions, line];
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer,
    });

    await this.loadContext();

    const askQuestion = () => {
      this.deps.tui.printPrompt();
      rl.question('', async (input) => {
        const trimmed = input.trim();
        if (!trimmed) { askQuestion(); return; }

        if (trimmed.startsWith('/')) {
          await this.handleCommand(trimmed);
          askQuestion();
          return;
        }

        try {
          await this.run(trimmed);
        } catch (error) {
          this.deps.tui.printError(error instanceof Error ? error.message : String(error));
        }

        askQuestion();
      });
    };

    askQuestion();

    process.on('SIGINT', () => {
      this.abort();
      rl.close();
      process.exit(0);
    });
  }

  // ── Slash Commands ────────────────────────────────────────────────────────

  private async handleCommand(input: string): Promise<void> {
    const [cmd, ...args] = input.slice(1).split(' ');

    switch (cmd) {
      case 'help':
        this.deps.tui.printHelp();
        break;

      case 'clear':
        this.messages = [];
        this.deps.tui.printMessage('Context cleared', 'success');
        break;

      case 'plan':
        await this.showPlan(args.join(' '));
        break;

      case 'tools':
        this.deps.tui.printToolList(this.deps.toolRegistry.listTools());
        break;

      case 'skills':
        await this.deps.tui.printSkillList(this.deps.skillManager);
        break;

      case 'memory':
        await this.deps.tui.printMemory(
          await this.deps.memorySystem.getAllLayers(this.deps.workdir)
        );
        break;

      case 'vault':
        await this.handleVaultCommand(args.join(' '));
        break;

      case 'notes': {
        const query = args.join(' ');
        if (!query) {
          this.deps.tui.printMessage('Usage: /notes <query>', 'error');
          break;
        }
        await this.handleVaultSearch(query);
        break;
      }

      case 'model':
        if (args.length > 0) {
          const requested = args.join(' ');
          this.config.model = requested;
          this.llm = new LLMProvider(this.config, this.deps.config);
          this.deps.tui.printMessage(`Model switched to: ${requested}`, 'success');
        } else {
          this.deps.tui.printMessage(`Current model: ${this.config.model}`, 'info');
          console.log('');
          console.log(`    ${chalk.hex('#FFE135')('•')} ${chalk.bold('Source flash')}  (Fastest local execution)`);
          console.log(`    ${chalk.hex('#FFE135')('•')} ${chalk.bold('Source PRO')}    (Balanced developer agent power — Default)`);
          console.log(`    ${chalk.hex('#FFE135')('•')} ${chalk.bold('Source Ultra')}  (Maximum reasoning and coding strength)`);
          console.log('');
        }
        break;

      case 'think':
        this.showThinking = !this.showThinking;
        this.deps.tui.printMessage(`Thinking display: ${this.showThinking ? 'on' : 'off'}`, 'info');
        break;

      case 'capabilities':
        this.deps.tui.printCapabilities();
        break;

      case 'doctor':
        this.deps.tui.printDoctor(this.deps.config);
        break;

      case 'status':
        this.deps.tui.printStartup('1.1.0', this.deps.config);
        break;

      case 'add': {
        const fileArg = args.join(' ');
        if (!fileArg) {
          this.deps.tui.printMessage('Usage: /add <file_path>', 'error');
          break;
        }
        await this.handleAddFileContext(fileArg);
        break;
      }

      case 'commit': {
        const msgArg = args.join(' ');
        await this.handleAutoCommit(msgArg);
        break;
      }

      case 'abort':
      case 'stop':
        this.abort();
        break;

      case 'exit':
      case 'quit':
        process.exit(0);
        break;

      case 'sessions':
        this.deps.tui.printSessionList(this.deps.sessionManager.listSessions());
        break;

      case 'agents':
        this.deps.tui.printAgentList(this.deps.config);
        break;

      case 'dashboard':
        this.deps.tui.printDashboard(this.deps.config, this.deps.sessionManager.listSessions());
        break;

      default:
        this.deps.tui.printMessage(`Unknown command: /${cmd}  (try /help)`, 'error');
    }
  }

  // ── Vault Commands ────────────────────────────────────────────────────────

  private async handleVaultCommand(query: string): Promise<void> {
    const vaultPath = this.deps.config.obsidian?.vaultPath;
    if (!vaultPath) {
      this.deps.tui.printMessage(
        'No Obsidian vault configured. Set obsidian.vaultPath in .opensource/opensource.json',
        'error'
      );
      return;
    }

    if (!query) {
      // Show vault summary
      const { readdirSync, readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');

      let noteCount = 0;
      const tags = new Set<string>();

      function walkDir(dir: string) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              walkDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              noteCount++;
              try {
                const content = readFileSync(fullPath, 'utf-8');
                const tagMatches = content.match(/#(\w+)/g);
                if (tagMatches) tagMatches.forEach(t => tags.add(t.slice(1)));
              } catch { /* skip */ }
            }
          }
        } catch { /* skip unreadable dirs */ }
      }

      if (existsSync(vaultPath)) {
        walkDir(vaultPath);
        this.deps.tui.printVaultSummary(vaultPath, noteCount, [...tags]);
      } else {
        this.deps.tui.printMessage(`Vault path not found: ${vaultPath}`, 'error');
      }
    } else {
      await this.handleVaultSearch(query);
    }
  }

  private async handleVaultSearch(query: string): Promise<void> {
    const vaultPath = this.deps.config.obsidian?.vaultPath;
    if (!vaultPath) {
      this.deps.tui.printMessage('No vault configured', 'error');
      return;
    }

    this.deps.tui.printMessage(`Searching vault: "${query}"…`, 'info');

    // Execute obsidian_search_notes tool directly
    try {
      const result = await this.deps.toolRegistry.executeTool(
        { id: uuidv4(), name: 'obsidian_search_notes', input: { query, maxResults: 8 } },
        { workdir: this.deps.workdir, sessionId: this.deps.sessionId, agentId: this.config.id }
      );
      if (result.isError) {
        this.deps.tui.printMessage(result.content, 'error');
      } else {
        // Print formatted search results
        const lines = result.content.split('\n');
        for (const line of lines) {
          process.stdout.write(line + '\n');
        }
      }
    } catch (error) {
      this.deps.tui.printMessage(
        error instanceof Error ? error.message : String(error),
        'error'
      );
    }
  }

  // ── Context Loading ───────────────────────────────────────────────────────

  private async loadContext(): Promise<void> {
    const systemPrompt = await this.buildSystemPrompt();

    this.messages.unshift({
      id: uuidv4(), role: 'system', content: systemPrompt, timestamp: new Date(),
    });

    if (this.deps.config.memory.enabled) {
      const memory = await this.deps.memorySystem.loadContext(this.deps.workdir);
      if (memory) {
        this.messages.splice(1, 0, {
          id: uuidv4(), role: 'system', content: `## Project Memory\n${memory}`, timestamp: new Date(),
        });
      }
    }

    if (this.deps.config.skills.enabled) {
      const skills = await this.deps.skillManager.getRelevantSkills(this.messages);
      if (skills.length > 0) {
        const skillContext = skills.map(s => `### ${s.name}\n${s.instructions}`).join('\n\n');
        this.messages.splice(1, 0, {
          id: uuidv4(), role: 'system', content: `## Active Skills\n${skillContext}`, timestamp: new Date(),
        });
      }
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    const parts: string[] = [buildCoreIdentity()];

    // AI persona from .opensource/ai.md
    const aiPersonaPath = (this.deps.config as unknown as Record<string, unknown>)._aiPersona as string | undefined;
    if (aiPersonaPath) {
      parts.push(`## Custom AI Persona\n${aiPersonaPath}`);
    }

    // Project-specific instructions from OPENSOURCE.md
    const opensourceMd = (this.deps.config as unknown as Record<string, unknown>)._opensourceMd as string | undefined;
    if (opensourceMd) {
      parts.push(`## Project Instructions\n${opensourceMd}`);
    }

    // Vault context
    if (this.deps.config.obsidian?.enabled && this.deps.config.obsidian.vaultPath) {
      parts.push(`## Obsidian Vault
Vault location: ${this.deps.config.obsidian.vaultPath}

Always search the vault before making major architectural decisions. Available vault tools:
- \`obsidian_search_notes\` — full-text search across all notes
- \`obsidian_read_note\` — read a specific note by title or path  
- \`obsidian_write_note\` — create or update notes
- \`obsidian_find_backlinks\` — find all notes linking to a note
- \`obsidian_find_links\` — find outgoing links from a note
- \`obsidian_list_notes\` — list notes filtered by tag or folder
- \`obsidian_graph\` — get vault statistics and connection data
- \`obsidian_reindex\` — refresh the vault index`);
    }

    // Tool list (cached)
    if (!this.cachedToolDescriptions) {
      const tools = this.deps.toolRegistry.listTools();
      this.cachedToolDescriptions = tools
        .map(t => `- **${t.name}**: ${t.description}`)
        .join('\n');
    }
    parts.push(`## Available Tools\n${this.cachedToolDescriptions}`);

    // Dynamic Workspace Scan
    const { scanWorkspace } = await import('../utils/workspace.js');
    const scan = scanWorkspace(this.deps.workdir);

    // Runtime context
    parts.push(`## Runtime Context
- Working directory: ${this.deps.workdir}
- Primary Source Directory: ./${scan.primaryDir}
- Session ID: ${this.deps.sessionId}
- Provider: ${this.deps.config.provider}
- Model: ${this.config.model}`);

    let structureContext = `## Workspace Directory Structure
Primary directory being edited: ./${scan.primaryDir}
Total Files: ${scan.totalFiles}

### Visual Directory Tree:
\`\`\`
${scan.treeString}
\`\`\``;

    if (Object.keys(scan.languages).length > 0) {
      structureContext += `\n\n### Primary Languages Detected:\n` + 
        Object.entries(scan.languages).map(([lang, cnt]) => `- ${lang}: ${cnt} file(s)`).join('\n');
    }

    parts.push(structureContext);

    return parts.join('\n\n');
  }

  // ── LLM Call ─────────────────────────────────────────────────────────────

  private async callLLM(): Promise<LLMResponse> {
    this.deps.tui.printThinking();

    const hookResult = await this.deps.hookManager.runHooks('pre-message', {
      hookType: 'pre-message',
      sessionId: this.deps.sessionId,
      agentId: this.config.id,
      data: { messageCount: this.messages.length },
    });

    if (!hookResult.allowed) {
      throw new Error(hookResult.message || 'Pre-message hook blocked the request');
    }

    const tools = this.deps.toolRegistry.getToolDefinitions();
    const hasTools = tools.length > 0;

    // Use streaming when no tools are present (tool calls require blocking mode)
    const response = await this.llm.chat(this.messages, {
      tools: hasTools ? tools : undefined,
      signal: this.abortController?.signal,
      onToken: hasTools ? undefined : (token) => {
        // Start streaming header on first token
        if (!this.deps.tui['isStreaming']) {
          this.deps.tui.startStreaming();
        }
        this.deps.tui.streamToken(token);
      },
    });

    // If we streamed, the content is already printed
    if (hasTools || !response.content) {
      // Normal path — printAssistantMessage called in run()
    } else {
      // Finish stream and skip re-printing in run()
      this.deps.tui.endStreaming();
    }

    await this.deps.hookManager.runHooks('post-message', {
      hookType: 'post-message',
      sessionId: this.deps.sessionId,
      agentId: this.config.id,
      message: { id: uuidv4(), role: 'assistant', content: response.content, timestamp: new Date() },
    });

    return response;
  }

  // ── Tool Execution ────────────────────────────────────────────────────────

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const hookResult = await this.deps.hookManager.runHooks('pre-tool-call', {
        hookType: 'pre-tool-call',
        sessionId: this.deps.sessionId,
        agentId: this.config.id,
        toolCall,
      });

      if (!hookResult.allowed) {
        results.push({
          toolCallId: toolCall.id,
          content: `Tool call blocked: ${hookResult.message || 'Hook denied execution'}`,
          isError: true,
        });
        continue;
      }

      const needsApproval = this.deps.config.tools.approvalRequired.includes(toolCall.name) ||
        this.deps.config.tools.approvalRequired.includes('*');
      const isAutoApproved = this.deps.config.agent.autoApprove.includes(toolCall.name) ||
        this.deps.config.agent.autoApprove.includes('*');

      if (needsApproval && !isAutoApproved) {
        const approved = await this.deps.tui.requestApproval(toolCall);
        if (!approved) {
          results.push({ toolCallId: toolCall.id, content: 'Tool call denied by user', isError: true });
          continue;
        }
      }

      this.deps.tui.printToolCall(toolCall);

      try {
        const result = await this.deps.toolRegistry.executeTool(toolCall, {
          workdir: this.deps.workdir,
          sessionId: this.deps.sessionId,
          agentId: this.config.id,
          signal: this.abortController?.signal,
        });

        results.push(result);

        await this.deps.hookManager.runHooks('post-tool-call', {
          hookType: 'post-tool-call',
          sessionId: this.deps.sessionId,
          agentId: this.config.id,
          toolCall,
          toolResult: result,
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        });
      }
    }

    return results;
  }

  // ── Planning ──────────────────────────────────────────────────────────────

  private async showPlan(goal: string): Promise<void> {
    if (!goal) {
      this.deps.tui.printMessage('Usage: /plan <goal>', 'error');
      return;
    }

    const planPrompt = `Create a detailed step-by-step execution plan for: ${goal}

Format as a numbered list. Each step must specify:
1. What action to take
2. Which tool to use (if any)
3. What success looks like

Be specific and actionable.`;

    this.messages.push({ id: uuidv4(), role: 'user', content: planPrompt, timestamp: new Date() });

    const response = await this.callLLM();
    this.deps.tui.printPlan(response.content);

    const approved = await this.deps.tui.requestPlanApproval();
    if (approved) {
      this.currentPlan = {
        id: uuidv4(),
        goal,
        steps: this.parsePlanSteps(response.content),
        status: 'approved',
        createdAt: new Date(),
      };
      this.deps.tui.printMessage('Plan approved — executing…', 'success');
    } else {
      this.deps.tui.printMessage('Plan rejected.', 'warning');
    }
  }

  private parsePlanSteps(content: string): PlanStep[] {
    return content
      .split('\n')
      .filter(l => l.trim())
      .map(line => ({
        id: uuidv4(),
        description: line.replace(/^\d+[.)]\s*/, ''),
        status: 'pending' as const,
      }));
  }

  // ── Control ───────────────────────────────────────────────────────────────

  abort(): void {
    this.isRunning = false;
    this.abortController?.abort();
    this.deps.tui.printMessage('Operation aborted', 'warning');
  }

  private getCommandDescription(cmd: string): string {
    const descriptions: Record<string, string> = {
      '/help': 'Display list of console commands',
      '/clear': 'Clear active context layers',
      '/plan': 'Design and execute a programmatic plan',
      '/tools': 'List all loaded system tools',
      '/skills': 'Show available custom agent skill bundles',
      '/memory': 'Print loaded memory layers',
      '/model': 'Change target model live',
      '/vault': 'Review connected Obsidian Vault settings',
      '/notes': 'Query your Obsidian knowledge base',
      '/think': 'Toggle detailed model thinking stream',
      '/sessions': 'List history logs and sessions',
      '/agents': 'Show active agent orchestrator',
      '/doctor': 'Run doctor diagnostics check',
      '/status': 'Show current system configuration',
      '/add': 'Load a specific file into conversational context',
      '/commit': 'Generate AI commit message and commit',
      '/exit': 'Close CLI agent session',
    };
    return descriptions[cmd] || '';
  }

  private async handleAddFileContext(fileArg: string): Promise<void> {
    const { existsSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const fullPath = join(this.deps.workdir, fileArg);

    if (!existsSync(fullPath)) {
      this.deps.tui.printMessage(`File not found: ${fileArg}`, 'error');
      return;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      this.messages.push({
        id: uuidv4(),
        role: 'system',
        content: `## User Added Context File: ${fileArg}\n\`\`\`\n${content}\n\`\`\``,
        timestamp: new Date(),
      });
      this.deps.tui.printMessage(`Added file to context: ${fileArg} (${content.split('\n').length} lines)`, 'success');
    } catch (error) {
      this.deps.tui.printMessage(`Could not read file: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private async handleAutoCommit(customMessage?: string): Promise<void> {
    const { execa } = await import('execa');
    
    // Check if git is initialized
    try {
      await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: this.deps.workdir });
    } catch {
      this.deps.tui.printMessage('Not a git repository.', 'error');
      return;
    }

    // Get the active diff
    let diff = '';
    try {
      const res = await execa('git', ['diff', 'HEAD'], { cwd: this.deps.workdir });
      diff = res.stdout;
    } catch {
      // maybe no commits yet, try standard diff
      try {
        const res = await execa('git', ['diff'], { cwd: this.deps.workdir });
        diff = res.stdout;
      } catch { /* skip */ }
    }

    if (!diff.trim()) {
      this.deps.tui.printMessage('No modifications detected. Working tree is clean.', 'warning');
      return;
    }

    let commitMessage = customMessage || '';
    if (!commitMessage) {
      this.deps.tui.printMessage('Generating AI commit message...', 'info');
      
      const commitPrompt = `Generate a concise, professional semantic git commit message following Conventional Commits convention (e.g. "feat: add user auth" or "fix: resolve memory leak"). Base it strictly on this git diff:\n\n${diff.slice(0, 4000)}\n\nRespond ONLY with the commit message, no explanations or other text.`;
      
      this.deps.tui.printThinking();
      const response = await this.llm.chat([
        { id: uuidv4(), role: 'user', content: commitPrompt, timestamp: new Date() }
      ]);
      this.deps.tui.stopThinking();
      
      commitMessage = response.content.trim().replace(/^`+|`+$/g, '');
    }

    this.deps.tui.printMessage(`Proposed Commit Message:\n  ${chalk.bold(commitMessage)}`, 'info');
    
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const approved = await new Promise<boolean>(res => {
      rl.question(`\n  Approve commit? (y/N): `, a => {
        rl.close();
        res(a.trim().toLowerCase() === 'y');
      });
    });

    if (approved) {
      try {
        // Stage changes if not staged
        await execa('git', ['add', '.'], { cwd: this.deps.workdir });
        // Commit
        const commitRes = await execa('git', ['commit', '-m', commitMessage], { cwd: this.deps.workdir });
        this.deps.tui.printMessage(`Commit complete:\n${commitRes.stdout}`, 'success');
      } catch (error) {
        this.deps.tui.printMessage(`Commit failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    } else {
      this.deps.tui.printMessage('Commit cancelled.', 'warning');
    }
  }

  private emit(event: NexusEvent): void {
    this.deps.sessionManager.emitEvent({ ...event, timestamp: new Date() });
  }
}
