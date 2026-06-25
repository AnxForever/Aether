/**
 * Skill Creator - Dynamic skill generation system
 */

import { createLogger } from '../utils/logger';
import { Tool, ToolParameter } from '../types';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('SkillCreator');

/**
 * Skill template
 */
export interface SkillTemplate {
  name: string;
  description: string;
  tools: ToolDefinition[];
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  implementation: string; // Code as string
}

/**
 * Skill Creator
 */
export class SkillCreator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * Generate skill from template
   */
  async generateSkill(template: SkillTemplate): Promise<string> {
    logger.info(`Generating skill: ${template.name}`);

    try {
      // Generate manifest
      const manifest = this.generateManifest(template);

      // Generate tools code
      const toolsCode = this.generateToolsCode(template.tools);

      // Generate index file
      const indexCode = this.generateIndexCode(template);

      // Create skill directory
      const skillDir = join(this.outputDir, this.sanitizeName(template.name));

      // Write files
      await writeFile(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      await writeFile(join(skillDir, 'tools.ts'), toolsCode);
      await writeFile(join(skillDir, 'index.ts'), indexCode);

      logger.info(`Skill generated: ${template.name}`);
      return skillDir;
    } catch (error: any) {
      logger.error('Skill generation failed:', error as Error);
      throw error;
    }
  }

  /**
   * Generate manifest
   */
  private generateManifest(template: SkillTemplate): any {
    return {
      id: this.sanitizeName(template.name),
      name: template.name,
      description: template.description,
      version: '1.0.0',
      author: 'Nexus Agent',
      main: 'index.ts',
      tools: template.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    };
  }

  /**
   * Generate tools code
   */
  private generateToolsCode(tools: ToolDefinition[]): string {
    const imports = `import { ToolResult } from '../types';`;

    const toolFunctions = tools
      .map(tool => {
        return `
/**
 * ${tool.description}
 */
export async function ${tool.name}(params: {
  ${tool.parameters
    .map(p => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
    .join(';\n  ')}
}): Promise<ToolResult> {
  try {
    ${tool.implementation}
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}`;
      })
      .join('\n\n');

    return `${imports}\n\n${toolFunctions}`;
  }

  /**
   * Generate index code
   */
  private generateIndexCode(template: SkillTemplate): string {
    const imports = template.tools.map(t => t.name).join(', ');

    return `import { Tool } from '../types';
import { ${imports} } from './tools';

export const tools: Tool[] = [
${template.tools
  .map(
    tool => `  {
    name: '${tool.name}',
    description: '${tool.description}',
    parameters: ${JSON.stringify(tool.parameters, null, 4)},
    handler: ${tool.name}
  }`
  )
  .join(',\n')}
];

export function initialize(api: any) {
  console.log('Skill initialized: ${template.name}');
}

export function cleanup() {
  console.log('Skill cleanup: ${template.name}');
}
`;
  }

  /**
   * Generate skill from user request
   */
  async createFromRequest(request: string): Promise<SkillTemplate> {
    logger.info(`Creating skill from request: ${request}`);

    // Parse request and generate template
    // In production, use LLM to understand request and generate template

    // Example implementation
    const template: SkillTemplate = {
      name: 'Generated Skill',
      description: `Skill generated from: ${request}`,
      tools: [
        {
          name: 'generatedTool',
          description: 'Auto-generated tool',
          parameters: [
            {
              name: 'input',
              type: 'string',
              description: 'Input parameter',
              required: true
            }
          ],
          implementation: `
    // Generated implementation
    const result = await processInput(params.input);

    return {
      success: true,
      data: result
    };
`
        }
      ]
    };

    return template;
  }

  /**
   * Improve existing skill
   */
  async improveSkill(skillId: string, improvements: string[]): Promise<void> {
    logger.info(`Improving skill: ${skillId}`);

    // Read existing skill
    // Apply improvements
    // Regenerate code

    logger.info('Skill improved');
  }

  /**
   * Validate skill template
   */
  validateTemplate(template: SkillTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name) {
      errors.push('Skill name is required');
    }

    if (!template.description) {
      errors.push('Skill description is required');
    }

    if (!template.tools || template.tools.length === 0) {
      errors.push('At least one tool is required');
    }

    for (const tool of template.tools || []) {
      if (!tool.name) {
        errors.push(`Tool name is required`);
      }

      if (!tool.description) {
        errors.push(`Tool description is required for ${tool.name}`);
      }

      if (!tool.implementation) {
        errors.push(`Tool implementation is required for ${tool.name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize name for filesystem
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
