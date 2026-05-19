// ============================================================================
// OpenSource CLI — Configuration System
// Local-first: Ollama by default, cloud APIs optional
// Vault auto-discovery · AI persona loading · Config validation
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import type { NexusConfig } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface NexusConfigInternal extends NexusConfig {
  _opensourceMd?: string;
  _aiPersona?: string;
}

export const DEFAULT_CONFIG: NexusConfig = {
  provider: 'ollama',
  model: 'Source PRO',
  fallbackModels: ['Source PRO', 'Source flash', 'Source Ultra'],

  memory: {
    enabled: true,
    layers: ['opensource-md', 'memory-md', 'obsidian-vault', 'conversation-history'],
    maxEntries: 1000,
  },

  skills: {
    enabled: true,
    paths: ['./.opensource/skills', '~/.opensource/skills'],
    autoCreate: true,
  },

  tools: {
    allowed: ['*'],
    denied: [],
    approvalRequired: ['shell', 'browser_navigate', 'file_write'],
  },

  hooks: {
    enabled: true,
    paths: ['./.opensource/hooks', '~/.opensource/hooks'],
  },

  mcp: {
    enabled: true,
    servers: [],
  },

  agent: {
    maxIterations: 100,
    planningMode: 'auto',
    autoApprove: [],
    contextWindow: 32768,
  },

  obsidian: {
    enabled: true,
    vaultPath: '',
    excludePatterns: ['.git', '.trash', '.obsidian'],
    indexOnStart: true,
  },

  gateway: {
    enabled: false,
    port: 3100,
    heartbeatInterval: 1800,
  },

  tui: {
    theme: 'dark',
    showToolCalls: true,
    showThinking: true,
    compactMode: false,
  },
};

export interface LoadConfigOptions {
  createIfMissing?: boolean;
  force?: boolean;
  vaultPath?: string;
}

export async function loadConfig(
  workdir: string,
  options: LoadConfigOptions = {}
): Promise<NexusConfigInternal> {
  const config: NexusConfigInternal = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // 1. Load global config (~/.opensource/opensource.json)
  const globalConfigPath = join(getHomeDir(), '.opensource', 'opensource.json');
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
      deepMerge(config as unknown as Record<string, unknown>, globalConfig);
    } catch { /* ignore malformed global config */ }
  }

  // 2. Load project config (.opensource/opensource.json)
  const projectRoot = findProjectRoot(workdir);
  if (projectRoot) {
    const projectConfigPath = join(projectRoot, '.opensource', 'opensource.json');
    if (existsSync(projectConfigPath)) {
      try {
        const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
        deepMerge(config as unknown as Record<string, unknown>, projectConfig);
      } catch { /* ignore malformed project config */ }
    }

    // 3. Load OPENSOURCE.md (project instructions)
    const opensourceMdPath = join(projectRoot, 'OPENSOURCE.md');
    if (existsSync(opensourceMdPath)) {
      config._opensourceMd = readFileSync(opensourceMdPath, 'utf-8');
    }

    // 4. Load AI persona (.opensource/ai.md)
    const aiPersonaPath = join(projectRoot, '.opensource', 'ai.md');
    if (existsSync(aiPersonaPath)) {
      config._aiPersona = readFileSync(aiPersonaPath, 'utf-8');
    }
  }

  // 5. Load global AI persona (~/.opensource/ai.md) if no project-level one
  if (!config._aiPersona) {
    const globalAiPersona = join(getHomeDir(), '.opensource', 'ai.md');
    if (existsSync(globalAiPersona)) {
      config._aiPersona = readFileSync(globalAiPersona, 'utf-8');
    }
  }

  // 6. CLI override for vault path
  if (options.vaultPath) {
    config.obsidian = { ...config.obsidian, vaultPath: options.vaultPath, enabled: true };
  }

  // 7. OBSIDIAN_VAULT env var
  if (!config.obsidian?.vaultPath && process.env.OBSIDIAN_VAULT) {
    config.obsidian = {
      ...config.obsidian,
      vaultPath: process.env.OBSIDIAN_VAULT,
      enabled: true,
    };
  }

  // 8. Auto-detect Obsidian vault if not configured
  if (config.obsidian?.enabled && !config.obsidian.vaultPath) {
    const detected = await detectObsidianVault(workdir);
    if (detected) {
      config.obsidian = { ...config.obsidian, vaultPath: detected };
    }
  }

  // 9. Validate vault path exists
  if (config.obsidian?.vaultPath && !existsSync(config.obsidian.vaultPath)) {
    // Path set but doesn't exist — clear it rather than error
    config.obsidian = { ...config.obsidian, vaultPath: '' };
  }

  // 10. Create default config if missing
  if (options.createIfMissing && projectRoot) {
    const osDir = join(projectRoot, '.opensource');
    if (!existsSync(osDir)) mkdirSync(osDir, { recursive: true });

    const configPath = join(osDir, 'opensource.json');
    if (!existsSync(configPath) || options.force) {
      const toWrite = { ...config };
      delete (toWrite as NexusConfigInternal)._opensourceMd;
      delete (toWrite as NexusConfigInternal)._aiPersona;
      writeFileSync(configPath, JSON.stringify(toWrite, null, 2));
    }

    const opensourceMdPath = join(projectRoot, 'OPENSOURCE.md');
    if (!existsSync(opensourceMdPath)) {
      writeFileSync(opensourceMdPath, DEFAULT_OPENSOURCE_MD);
    }

    const aiMdPath = join(osDir, 'ai.md');
    if (!existsSync(aiMdPath)) {
      writeFileSync(aiMdPath, DEFAULT_AI_MD);
    }

    const skillsDir = join(osDir, 'skills');
    if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });

    const hooksDir = join(osDir, 'hooks');
    if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  }

  return config;
}

const projectRootCache = new Map<string, string | null>();

export function findProjectRoot(startDir: string): string | null {
  const cached = projectRootCache.get(startDir);
  if (cached !== undefined) return cached;

  let current = startDir;
  const markers = [
    'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
    'pom.xml', 'build.gradle', 'CMakeLists.txt', 'Gemfile',
    'composer.json', '.git', 'OPENSOURCE.md',
  ];

  while (true) {
    for (const marker of markers) {
      if (existsSync(join(current, marker))) {
        projectRootCache.set(startDir, current);
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  projectRootCache.set(startDir, startDir);
  return startDir;
}

async function detectObsidianVault(startDir: string): Promise<string> {
  const obsidianMarkers = ['.obsidian', '.obsidian/app.json', '.obsidian/workspace.json'];

  // Check current directory and parents (up to 5 levels)
  let current = startDir;
  for (let depth = 0; depth < 6; depth++) {
    for (const marker of obsidianMarkers) {
      if (existsSync(join(current, marker))) return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Check common vault locations per platform
  const home = getHomeDir();
  const commonPaths = [
    // Windows
    join(home, 'OneDrive', 'Obsidian'),
    join(home, 'OneDrive', 'Documents', 'Obsidian'),
    join(home, 'Documents', 'Obsidian'),
    join(home, 'Obsidian Vault'),
    join(home, 'Obsidian'),
    join(home, 'vault'),
    join(home, 'Vault'),
    // macOS / Linux
    join(home, 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents'),
    join(home, 'iCloud Drive', 'Obsidian'),
  ];

  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }

  return '';
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
      typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])
    ) {
      deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      target[key] = source[key];
    }
  }
}

function getHomeDir(): string {
  try { return process.env.HOME || process.env.USERPROFILE || homedir(); } catch { return ''; }
}

// ── Default file templates ────────────────────────────────────────────────────

const DEFAULT_OPENSOURCE_MD = `# OPENSOURCE.md

Project-specific instructions for the OpenSource CLI AI agent.

## Project Overview
<!-- Describe your project here -->

## Build Commands
<!-- How to build, test, lint -->

## Coding Standards
<!-- Conventions, patterns, rules -->

## Architecture
<!-- Key architectural decisions -->

## Important Notes
<!-- Anything the agent should always know -->
`;

const DEFAULT_AI_MD = `# AI Persona

Customize how OpenSource CLI behaves in this project.

## Personality
You are a pragmatic, senior engineer. You prefer clean, minimal solutions.
You always explain WHY before HOW for architectural decisions.

## Domain Expertise
<!-- e.g., "This is a React/TypeScript SPA using React Query and Zustand." -->

## Preferred Patterns
<!-- e.g., "Use functional components. Prefer composition over inheritance." -->

## Restrictions
<!-- e.g., "Never use class-based React components." -->

## Context
<!-- Additional project context the AI should always have -->
`;
