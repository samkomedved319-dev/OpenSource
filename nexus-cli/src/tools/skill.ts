// ============================================================================
// OpenSource CLI - Skill Tools
// Create, list, and execute skills
// ============================================================================

import type { ToolRegistry } from './registry.js';
import type { SkillManager } from '../skills/index.js';

let skillManagerRef: SkillManager | null = null;

export function setSkillManagerRef(sm: SkillManager): void {
  skillManagerRef = sm;
}

export function registerSkillTools(registry: ToolRegistry): void {
  registry.register({
    name: 'create_skill',
    description: 'Create a new reusable skill from the current task pattern. Skills are markdown files that teach the agent how to handle specific types of tasks.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name (kebab-case)' },
        description: { type: 'string', description: 'What this skill does' },
        triggers: { type: 'array', items: { type: 'string' }, description: 'Keywords/phrases that trigger this skill' },
        instructions: { type: 'string', description: 'Step-by-step instructions for the agent' },
      },
      required: ['name', 'description', 'triggers', 'instructions'],
    },
    handler: async (args, context) => {
      if (!skillManagerRef) {
        return { toolCallId: '', content: 'Skill manager not initialized', isError: true };
      }

      try {
        await skillManagerRef.saveSkill({
          name: args.name as string,
          description: args.description as string,
          version: '1.0.0',
          triggers: args.triggers as string[],
          instructions: args.instructions as string,
          category: 'custom',
        }, context.workdir);

        return { toolCallId: '', content: `Skill "${args.name}" created successfully` };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Skill creation error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'skill',
  });

  registry.register({
    name: 'list_skills',
    description: 'List all available skills with their descriptions and trigger keywords.',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      if (!skillManagerRef) {
        return { toolCallId: '', content: 'Skill manager not initialized', isError: true };
      }

      const skills = skillManagerRef.listSkills();
      const output = skills.map(s =>
        `## ${s.name}\n- Description: ${s.description}\n- Triggers: ${s.triggers.join(', ')}\n- Category: ${s.category || 'general'}`
      ).join('\n\n');

      return {
        toolCallId: '',
        content: output || 'No skills available',
      };
    },
    category: 'skill',
  });
}
