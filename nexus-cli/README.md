# OpenSource

> **The Ultimate Local-First AI Coding Agent**
>
> No API keys. No cloud. Runs on your machine. Deep Obsidian Vault integration. Self-improving skills. Multi-agent orchestration.

## One Command

```bash
npm run run
```

That's it. Installs, builds, and starts.

## Quick Start

```bash
# Clone
git clone https://github.com/your-org/opensource.git
cd opensource

# One command to run
npm run run

# Or with a prompt
npm run run -- "Explain this codebase"

# Dashboard
npm run run -- dashboard

# Doctor
npm run run -- doctor
```

## What It Does

OpenSource is a **terminal-first AI coding agent** that runs entirely on your machine. It reads your codebase, edits files, runs commands, manages git, and learns from experience — all locally.

### Core Features

| Feature | Description |
|---------|-------------|
| **Local-First** | Ollama by default. Zero API keys. Zero cloud dependency. |
| **Obsidian Vault** | Read, write, search, and navigate your personal knowledge base |
| **Self-Improving Skills** | Creates reusable skills from repeated patterns |
| **Multi-Agent** | Spawn sub-agents for parallel task execution |
| **Memory System** | 4-layer memory: project config, learned patterns, Obsidian, conversations |
| **22+ Tools** | Files, shell, search, web, git, browser, memory, skills, agents, Obsidian |
| **Hooks** | Pre/post execution validation, safety checks, rate limiting |
| **MCP** | Connect external tool servers via Model Context Protocol |
| **Gateway** | Run as a persistent daemon with heartbeat and WebSocket API |

### 22 Built-in Tools

**Files:** `read_file` · `write_file` · `edit_file` · `read_multiple_files` · `list_directory` · `file_search`

**Shell:** `shell`

**Search:** `search_files` · `find_symbol`

**Web:** `web_search` · `fetch_url`

**Git:** `git` · `git_status`

**Browser:** `browser_navigate`

**Memory:** `save_memory` · `search_memory`

**Skills:** `create_skill` · `list_skills`

**Agents:** `spawn_agent` · `parallel_agents`

**Obsidian:** `obsidian_read_note` · `obsidian_write_note` · `obsidian_search_notes` · `obsidian_list_notes` · `obsidian_find_backlinks` · `obsidian_find_links` · `obsidian_graph` · `obsidian_reindex`

## Commands

```bash
# Interactive session
opensource

# One-shot
opensource "Fix the auth bug"

# Plan first
opensource --plan "Add user authentication"

# Auto-approve
opensource --auto "Refactor the API"

# Dashboard
opensource dashboard

# Check config
opensource doctor

# Initialize in project
opensource init

# Gateway daemon
opensource gateway

# List agents
opensource agents list

# List skills
opensource skills list

# Show memory
opensource memory show
```

## Slash Commands (Interactive)

```
/help              Show help
/clear             Clear context
/plan <goal>       Plan before executing
/tools             List tools
/skills            List skills
/memory            Show memory
/model [name]      Change model
/vault             Browse Obsidian vault
/sessions          List sessions
/agents            List agents
/dashboard         Show dashboard
/abort             Stop execution
/exit              Exit
```

## Configuration

### Default: Local (No API Keys)

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.2
opensource
```

### Optional: Cloud

```bash
export ANTHROPIC_API_KEY=sk-...
opensource -p anthropic -m claude-sonnet-4-20250514

export OPENAI_API_KEY=sk-...
opensource -p openai -m gpt-4o

export OPENROUTER_API_KEY=sk-...
opensource -p openrouter -m openai/gpt-4o
```

### Obsidian Vault

Auto-detected. Or set in `.opensource/opensource.json`:

```json
{
  "obsidian": {
    "enabled": true,
    "vaultPath": "/path/to/your/vault"
  }
}
```

### Full Config

```json
{
  "provider": "ollama",
  "model": "llama3.2",
  "fallbackModels": ["llama3.2", "mistral", "qwen2.5-coder"],
  "memory": { "enabled": true },
  "skills": { "enabled": true, "autoCreate": true },
  "obsidian": { "enabled": true, "vaultPath": "" },
  "agent": { "maxIterations": 100, "planningMode": "auto" }
}
```

## Project Structure

```
src/
├── index.ts           # CLI entry point
├── core/
│   ├── agent.ts       # Core agent loop (Plan → Execute → Observe → Learn)
│   └── llm.ts         # Multi-provider LLM (local-first)
├── tools/
│   ├── registry.ts    # Tool registry
│   ├── file.ts        # Filesystem tools (6)
│   ├── shell.ts       # Shell execution
│   ├── search.ts      # Code search (2)
│   ├── web.ts         # Web search & fetch (2)
│   ├── git.ts         # Git operations (2)
│   ├── browser.ts     # Browser automation
│   ├── memory.ts      # Memory tools (2)
│   ├── skill.ts       # Skill tools (2)
│   ├── agent.ts       # Sub-agent spawning (2)
│   └── obsidian.ts    # Obsidian Vault (8)
├── memory/
│   └── index.ts       # 4-layer memory system
├── skills/
│   └── index.ts       # Self-improving skills
├── hooks/
│   └── index.ts       # Pre/post execution hooks
├── mcp/
│   └── index.ts       # MCP server integration
├── gateway/
│   └── index.ts       # Gateway daemon
├── sessions/
│   └── index.ts       # Session management
├── tui/
│   └── renderer.ts    # Modern UX engine
├── config/
│   └── index.ts       # Hierarchical configuration
└── types/
    └── index.ts       # TypeScript definitions
```

## Comparison

| Feature | OpenSource | Claude Code | OpenClaw | Hermes | OpenCode |
|---------|:----------:|:-----------:|:--------:|:------:|:--------:|
| **Local-First** | ✓ | ✗ | ✗ | ✓ | ✗ |
| **No API Key** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Obsidian Vault** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Self-Improving Skills** | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Multi-Layer Memory** | ✓ | ✓ | ✓ | ✓ | Basic |
| **Sub-Agent Spawning** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Parallel Agents** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Hooks System** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **MCP Integration** | ✓ | ✓ | ✗ | ✗ | Limited |
| **Gateway/Daemon** | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Dashboard** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Open Source** | ✓ | ✗ | ✓ | ✓ | ✓ |

## License

MIT
