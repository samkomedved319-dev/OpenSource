// ============================================================================
// OpenSource CLI - Skill Manager
// Self-improving skill system: discover, create, execute, and evolve skills
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SkillDefinition, SkillInstance, Message, NexusConfig } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SkillManager {
  private config: NexusConfig;
  private skills: Map<string, SkillInstance> = new Map();

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async discoverSkills(): Promise<void> {
    const paths = this.config.skills.paths;

    for (const basePath of paths) {
      const resolvedPath = basePath.startsWith('~')
        ? join(process.env.HOME || process.env.USERPROFILE || '', basePath.slice(1))
        : basePath;

      if (!existsSync(resolvedPath)) continue;

      await this.discoverSkillsInDir(resolvedPath);
    }

    // Discover bundled skills
    const bundledPath = join(__dirname, '..', '..', 'skills');
    if (existsSync(bundledPath)) {
      await this.discoverSkillsInDir(bundledPath);
    }
  }

  private async discoverSkillsInDir(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(dirPath, entry.name, 'SKILL.md');
          if (existsSync(skillPath)) {
            await this.loadSkill(skillPath);
          }
        } else if (entry.name === 'SKILL.md') {
          await this.loadSkill(join(dirPath, entry.name));
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  private async loadSkill(skillPath: string): Promise<void> {
    try {
      const content = readFileSync(skillPath, 'utf-8');
      const skill = this.parseSkillMarkdown(content, skillPath);

      if (skill) {
        this.skills.set(skill.name, {
          ...skill,
          path: skillPath,
          enabled: true,
          useCount: 0,
        });
      }
    } catch {
      // Skip invalid skill files
    }
  }

  private parseSkillMarkdown(content: string, path: string): SkillDefinition | null {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) return null;

    const yaml = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // Simple YAML parsing
    const parseYamlValue = (value: string): string | string[] => {
      value = value.trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        return value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
      }
      return value.replace(/['"]/g, '');
    };

    const props: Record<string, string | string[]> = {};
    for (const line of yaml.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        props[match[1]] = parseYamlValue(match[2]);
      }
    }

    return {
      name: (props.name as string) || 'unnamed',
      description: (props.description as string) || '',
      version: (props.version as string) || '1.0.0',
      author: props.author as string,
      license: props.license as string,
      triggers: (props.triggers as string[]) || [],
      instructions: body.trim(),
      category: props.category as string,
      tags: (props.tags as string[]) || [],
    };
  }

  async getRelevantSkills(messages: Message[]): Promise<SkillInstance[]> {
    const relevant: SkillInstance[] = [];
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

    if (!lastUserMessage) return relevant;

    const userContent = typeof lastUserMessage.content === 'string'
      ? lastUserMessage.content.toLowerCase()
      : '';

    for (const skill of this.skills.values()) {
      if (!skill.enabled) continue;

      // Check if any trigger matches
      for (const trigger of skill.triggers) {
        if (userContent.includes(trigger.toLowerCase())) {
          relevant.push(skill);
          break;
        }
      }
    }

    return relevant;
  }

  async saveSkill(skill: SkillDefinition, workdir: string): Promise<void> {
    const skillsDir = join(workdir, '.opensource', 'skills', skill.name);
    mkdirSync(skillsDir, { recursive: true });

    const skillPath = join(skillsDir, 'SKILL.md');
    const content = this.skillToMarkdown(skill);
    writeFileSync(skillPath, content, 'utf-8');

    // Reload
    await this.loadSkill(skillPath);
  }

  async tryCreateSkill(messages: Message[], workdir: string): Promise<void> {
    if (!this.config.skills.autoCreate) return;

    // Simple heuristic: if the conversation involved repeated patterns
    // that could be automated, suggest creating a skill
    const toolCalls = messages.filter(m => m.role === 'tool' && m.toolName);

    if (toolCalls.length < 5) return; // Need enough tool calls to identify a pattern

    // Check for repeated tool usage patterns
    const toolNames = toolCalls.map(t => t.toolName).filter(Boolean) as string[];
    const uniqueTools = new Set(toolNames);

    if (uniqueTools.size < 2) return; // Need variety

    // For now, we'll just log the suggestion
    // In a full implementation, we'd use the LLM to generate the skill
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    const goal = typeof lastUserMessage.content === 'string'
      ? lastUserMessage.content.slice(0, 100)
      : '';

    // Auto-create a basic skill template
    const skillName = this.generateSkillName(goal);
    const skill: SkillDefinition = {
      name: skillName,
      description: `Auto-generated skill for: ${goal.slice(0, 80)}`,
      version: '1.0.0',
      triggers: goal.split(' ').slice(0, 3).filter(w => w.length > 3),
      instructions: `# ${skillName}\n\n## When to use\nWhen the user asks to: ${goal.slice(0, 100)}\n\n## Steps\n1. Analyze the request\n2. Use appropriate tools\n3. Verify the result\n\n## Notes\nThis skill was auto-generated. Review and improve the instructions.`,
      category: 'auto-generated',
    };

    await this.saveSkill(skill, workdir);
  }

  listSkills(): SkillInstance[] {
    return Array.from(this.skills.values());
  }

  getSkill(name: string): SkillInstance | undefined {
    return this.skills.get(name);
  }

  private skillToMarkdown(skill: SkillDefinition): string {
    return `---
name: ${skill.name}
description: ${skill.description}
version: ${skill.version}
triggers: [${skill.triggers.join(', ')}]
category: ${skill.category || 'general'}
---

${skill.instructions}
`;
  }

  private generateSkillName(goal: string): string {
    return goal
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join('-') || 'unnamed-skill';
  }

  async createSkill(name: string): Promise<void> {
    // Create a skill template
    const skill: SkillDefinition = {
      name,
      description: 'TODO: Describe what this skill does',
      version: '1.0.0',
      triggers: ['TODO'],
      instructions: `# ${name}\n\n## When to use\nTODO\n\n## Steps\n1. TODO\n\n## Notes\nTODO`,
      category: 'custom',
    };

    await this.saveSkill(skill, process.cwd());
  }
}
