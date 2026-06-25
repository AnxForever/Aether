/**
 * Skills Module Index
 */

export * from './types';
export * from './base-skill';
export * from './skill-manager';
export * from './registry';
export * from './loader';

// Export skill implementations
export * from './gmail';
export * from './sheets';
export * from './docs';
export * from './calendar';
export * from './github';
export * from './office';
export * from './creative';
export * from './system';

// Skill factory and utility functions
import { BaseSkill } from './base-skill';
import { SkillManager } from './skill-manager';
import type { SkillContext } from './types';
import { GmailSkill } from './gmail';
import { SheetsSkill } from './sheets';
import { DocsSkill } from './docs';
import { CalendarSkill } from './calendar';
import { GitHubSkill } from './github';
import { OfficeSkill } from './office';
import { CreativeSkill } from './creative';
import { SystemSkill } from './system';

/**
 * Create a SkillManager with all core skills registered
 */
export function createSkillManager(context: SkillContext): SkillManager {
  const manager = new SkillManager(context);

  // Register all core skills
  const coreSkills: BaseSkill[] = [
    new GmailSkill(),
    new SheetsSkill(),
    new DocsSkill(),
    new CalendarSkill(),
    new GitHubSkill(),
    new OfficeSkill(),
    new CreativeSkill(),
    new SystemSkill(),
  ];

  for (const skill of coreSkills) {
    manager.registerSkill(skill);
  }

  return manager;
}

/**
 * Get list of all available core skills
 */
export function getAvailableSkills(): Array<{ id: string; name: string; description: string }> {
  return [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Gmail email reading, sending, and management',
    },
    {
      id: 'sheets',
      name: 'Google Sheets',
      description: 'Google Sheets reading, writing, and data manipulation',
    },
    {
      id: 'docs',
      name: 'Google Docs',
      description: 'Google Docs reading, creation, and editing',
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Google Calendar event creation, reading, and management',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'GitHub repository, issue, and PR management',
    },
    {
      id: 'office',
      name: 'Office Documents',
      description: 'PDF, Excel, Word, and PowerPoint file operations',
    },
    {
      id: 'creative',
      name: 'Creative Tools',
      description: 'Image generation, text-to-speech, and speech-to-text',
    },
    {
      id: 'system',
      name: 'System Tools',
      description: 'File operations, process management, and system utilities',
    },
  ];
}

/**
 * Create a specific skill by ID
 */
export function createSkill(skillId: string): BaseSkill | null {
  switch (skillId) {
    case 'gmail':
      return new GmailSkill();
    case 'sheets':
      return new SheetsSkill();
    case 'docs':
      return new DocsSkill();
    case 'calendar':
      return new CalendarSkill();
    case 'github':
      return new GitHubSkill();
    case 'office':
      return new OfficeSkill();
    case 'creative':
      return new CreativeSkill();
    case 'system':
      return new SystemSkill();
    default:
      return null;
  }
}
