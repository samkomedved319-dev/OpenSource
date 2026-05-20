# OpenSource CLI

> **The Ultimate Local-First AI Coding Agent**
>
> No API keys. No cloud. Runs entirely on your machine. Deep Obsidian Vault integration. Self-improving skills. Multi-agent orchestration.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

---

## Quick Start

```bash
# Install globally
npm install -g opensource-cli

# Make sure Ollama is running
ollama serve

# Start your AI coding agent
opensource
```

That's it. No API keys. No cloud accounts. Just your terminal and a local LLM.

```bash
# One-shot mode
opensource "Explain this codebase"

# Interactive REPL
opensource

# Auto-approve tool execution
opensource --auto "Refactor the auth module"

# Skip workspace scan
opensource --no-scan

# Check your setup
opensource doctor

# Visual dashboard
opensource dashboard
```

---

## What It Is

OpenSource is a **terminal-first AI coding agent** that runs entirely on your machine. It reads your codebase, edits files, runs commands, manages git, and learns from experience — all locally via Ollama.

No data leaves your computer. No subscriptions. No rate limits.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Local-First** | Ollama by default. Zero API keys. Zero cloud dependency. |
| **Workspace Scan** | Visual directory tree on startup (toggle with `--no-scan`) |
| **Obsidian Vault** | Read, write, search, and navigate your personal knowledge base |
| **Self-Improving Skills** | Creates reusable skills from repeated patterns |
| **Multi-Agent** | Spawn sub-agents for parallel task execution |
| **Memory System** | 4-layer memory: project config, learned patterns, Obsidian, conversations |
| **28+ Tools** | Files, shell, search, web, git, browser, memory, skills, agents, Obsidian |
| **Hooks** | Pre/post execution validation, safety checks, rate limiting |
| **MCP** | Connect external tool servers via Model Context Protocol |
| **Gateway** | Run as a persistent daemon with REST API endpoints |
| **Thinking Stream** | Real-time model reasoning visible in the terminal |
| **Tool Calling** | Prompt-based XML `<tool_call>` engine for 100% local model compatibility |

---

## What's New in v1.1.0

- **Workspace Scan Toggle** — Configurable via `tui.showWorkspaceTree` in config or `--no-scan` CLI flag
- **Ollama Tool-Calling Fix** — Prompt-based XML `<tool_call>` engine replaces native API tools parameter, completely eliminating hangs and JSON schema leaking on small local models
- **Thinking Streaming** — Real-time `reasoning_content` (Ollama) and `<think>` tag extraction with live TUI output
- **`/preview` Command** — Preview suite for plans, commits, files, status, tools, and website
- **Gateway REST API** — New endpoints: `/api/doctor`, `/api/config`, `/api/models/pull`, `/api/workspace`
- **Unicode Fallback** — Terminal symbols gracefully degrade on non-Unicode terminals
- **Improved Error Messages** — Step-by-step actionable guidance for connection failures

---

## CLI Options

```
Usage: opensource [options] [command] [prompt]

Arguments:
  prompt                     Initial prompt or question

Options:
  -V, --version              Output version number
  -w, --workdir <dir>        Working directory
  -m, --model <model>        Model to use (e.g., llama3.2, qwen2.5-coder)
  -p, --provider <provider>  LLM provider (ollama, anthropic, openai, etc.)
  --vault <path>             Obsidian vault path
  --plan                     Show plan before executing
  --auto                     Auto-approve all tool calls
  --verbose                  Show verbose diagnostics
  --compact                  Use compact TUI mode
  --no-tui                   Disable rich TUI output
  --no-scan                  Disable workspace structure scan on startup
  --agent <agent>            Agent profile to use (default: main)
  --session <session>        Resume an existing session

Commands:
  dashboard     Show session dashboard
  doctor        Check configuration and environment
  gateway       Start gateway daemon
  agents        Manage agent profiles
  skills        Manage skills
  memory        Manage memory
  sessions      Manage sessions
  init          Initialize OpenSource in current project
  notes [query] Quick Obsidian vault search

Aliases: opensource, os
```

---

## Slash Commands (Interactive Mode)

```
/help              Display help
/clear             Clear context
/plan <goal>       Plan before executing
/tools             List all tools
/skills            List skills
/memory            Show memory layers
/model [name]      Change model
/vault             Browse Obsidian vault
/notes <query>     Search Obsidian notes
/think             Toggle thinking stream display
/status            Show system configuration
/doctor            Run diagnostics
/dashboard         Show dashboard
/add <file>        Load file into context
/commit [msg]      AI commit with diff preview
/preview <cmd>     Preview: plan, commit, file, status, tools, website
/sessions          List sessions
/agents            List agents
/exit              Exit
```

---

## 28 Built-in Tools

**Files (6):** `read_file` · `write_file` · `edit_file` · `read_multiple_files` · `list_directory` · `file_search`

**Shell (1):** `shell`

**Search (2):** `search_files` · `find_symbol`

**Web (2):** `web_search` · `fetch_url`

**Git (2):** `git` · `git_status`

**Browser (1):** `browser_navigate`

**Memory (2):** `save_memory` · `search_memory`

**Skills (2):** `create_skill` · `list_skills`

**Agents (2):** `spawn_agent` · `parallel_agents`

**Obsidian (8):** `obsidian_read_note` · `obsidian_write_note` · `obsidian_search_notes` · `obsidian_list_notes` · `obsidian_find_backlinks` · `obsidian_find_links` · `obsidian_graph` · `obsidian_reindex`

---

## Configuration

### Default: Local (No API Keys)

```bash
# Install Ollama: https://ollama.com
ollama pull qwen2.5-coder:7b
opensource
```

### Optional: Cloud Providers

```bash
export ANTHROPIC_API_KEY=sk-...
opensource -p anthropic -m claude-sonnet-4-20250514

export OPENAI_API_KEY=sk-...
opensource -p openai -m gpt-4o

export OPENROUTER_API_KEY=sk-...
opensource -p openrouter -m openai/gpt-4o
```

### Obsidian Vault Integration

Auto-detected, or set in `.opensource/opensource.json`:

```json
{
  "obsidian": {
    "enabled": true,
    "vaultPath": "/path/to/your/vault"
  }
}
```

### Full Configuration

```json
{
  "provider": "ollama",
  "model": "qwen2.5-coder:7b",
  "fallbackModels": ["llama3.2", "mistral", "qwen2.5-coder"],
  "memory": { "enabled": true },
  "skills": { "enabled": true, "autoCreate": true },
  "obsidian": { "enabled": true, "vaultPath": "" },
  "agent": { "maxIterations": 100, "planningMode": "auto" },
  "tui": {
    "theme": "dark",
    "showToolCalls": true,
    "showThinking": true,
    "compactMode": false,
    "showWorkspaceTree": true
  }
}
```

---

## Model Aliases

OpenSource comes with three built-in model aliases that map to the best available Ollama models on your system:

| Alias | Target | Best For |
|-------|--------|----------|
| `Source flash` | Smallest available (8GB+ RAM) | Fast autocomplete, quick edits |
| `Source PRO` | Medium 7B-14B (16GB+ RAM) | Balanced coding, planning, multi-file |
| `Source Ultra` | Largest available (32GB+ RAM) | Complex architecture, deep reasoning |

---

## Project Structure

```
opensource-cli/
├── src/
│   ├── index.ts           # CLI entry point (Commander)
│   ├── core/
│   │   ├── agent.ts       # Agent loop: Plan → Execute → Observe → Learn
│   │   └── llm.ts         # Multi-provider LLM (Ollama-first, XML tool calls)
│   ├── tools/
│   │   ├── registry.ts    # Tool registry & discovery
│   │   ├── file.ts        # Filesystem tools
│   │   ├── shell.ts       # Shell execution
│   │   ├── search.ts      # Code search
│   │   ├── web.ts         # Web search & fetch
│   │   ├── git.ts         # Git operations
│   │   ├── browser.ts     # Browser automation (Playwright)
│   │   ├── memory.ts      # Memory tools
│   │   ├── skill.ts       # Skill management tools
│   │   ├── agent.ts       # Sub-agent spawning
│   │   └── obsidian.ts    # Obsidian Vault integration (8 tools)
│   ├── config/
│   │   └── index.ts       # Hierarchical JSON config loader
│   ├── memory/
│   │   └── index.ts       # SQLite conversation memory
│   ├── skills/
│   │   └── index.ts       # Self-improving skills engine
│   ├── sessions/
│   │   └── index.ts       # Session management
│   ├── hooks/
│   │   └── index.ts       # Pre/post execution hooks
│   ├── mcp/
│   │   └── index.ts       # MCP server integration
│   ├── gateway/
│   │   └── index.ts       # Gateway daemon with REST API
│   ├── tui/
│   │   └── renderer.ts    # Modern terminal UI engine
│   ├── utils/
│   │   └── workspace.ts   # Workspace scanning & tree generation
│   └── types/
│       └── index.ts       # TypeScript type definitions
├── docs/                  # Website (GitHub Pages)
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Comparison

| Feature | OpenSource | Claude Code | OpenClaw | Hermes | OpenCode |
|---------|:----------:|:-----------:|:--------:|:------:|:--------:|
| **Local-First** | ✓ | ✗ | ✗ | ✓ | ✗ |
| **No API Key** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Obsidian Vault** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Workspace Scan** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Thinking Stream** | ✓ | ✓ | Basic | ✗ | ✗ |
| **Self-Improving Skills** | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Multi-Layer Memory** | ✓ | ✓ | ✓ | ✓ | Basic |
| **Sub-Agent Spawning** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Parallel Agents** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Hooks System** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **MCP Integration** | ✓ | ✓ | ✗ | ✗ | Limited |
| **Gateway/Daemon** | ✓ | ✗ | ✓ | ✓ | ✗ |
| **REST API** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Dashboard** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Open Source** | ✓ | ✗ | ✓ | ✓ | ✓ |

---

## Gateway REST API

Start the gateway daemon:

```bash
opensource gateway
```

Available endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with active sessions |
| `/api/doctor` | GET | Full diagnostic: Ollama, Git, Obsidian status |
| `/api/config` | POST | Update config settings at runtime |
| `/api/models/pull` | POST | Pull a new Ollama model stream |
| `/api/workspace` | GET | Scan and return workspace file tree |

---

## Development

```bash
# Clone and install
git clone https://github.com/samkomedved319-dev/OpenSource.git
cd opensource-cli
npm install

# Build
npm run build

# Development (hot-reload via tsx)
npm run dev

# Test
npm test

# Lint & Format
npm run lint
npm run format
```

---

## Website

The OpenSource website lives in `docs/` and is GitHub Pages compatible:

```bash
# Start local preview from the CLI
opensource --workdir .. --auto "start preview server on port 4999"
# Or use the /preview website command in REPL
```

Visit: [https://samkomedved319-dev.github.io/OpenSource](https://samkomedved319-dev.github.io/OpenSource)

---

## License

MIT © 2026 — Built with ❤️ for the open-source community.
