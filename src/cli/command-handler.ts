import { PiAgentAdapter } from '../agent/pi-adapter';
import { SkillRegistry } from '../skills/registry';

export interface CommandContext {
  agent: PiAgentAdapter;
  skillRegistry: SkillRegistry;
  args: string[];
  options: Record<string, string | boolean>;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export type CommandHandler = (context: CommandContext) => Promise<CommandResult>;

export class CommandHandlerRegistry {
  private handlers: Map<string, CommandHandler> = new Map();

  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command, handler);
  }

  async execute(command: string, context: CommandContext): Promise<CommandResult> {
    const handler = this.handlers.get(command);

    if (!handler) {
      return {
        success: false,
        error: `Unknown command: ${command}`,
      };
    }

    try {
      return await handler(context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  hasCommand(command: string): boolean {
    return this.handlers.has(command);
  }

  listCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Built-in command handlers

export const executeHandler: CommandHandler = async (context) => {
  const input = context.args.join(' ');

  if (!input) {
    return {
      success: false,
      error: 'Missing required argument: input',
    };
  }

  const result = await context.agent.execute(input);

  return {
    success: true,
    message: 'Agent execution completed',
    data: result,
  };
};

export const skillListHandler: CommandHandler = async (context) => {
  const skills = context.skillRegistry.listSkills().map((skill) => ({
    name: skill.name,
    description: skill.description,
    version: skill.version,
    category: 'general', // Skill interface doesn't have category
  }));

  return {
    success: true,
    data: skills,
  };
};

export const skillInvokeHandler: CommandHandler = async (context) => {
  const skillName = context.args[0];

  if (!skillName) {
    return {
      success: false,
      error: 'Missing required argument: skill name',
    };
  }

  const skill = context.skillRegistry.getSkill(skillName);

  if (!skill) {
    return {
      success: false,
      error: `Skill not found: ${skillName}`,
    };
  }

  const args = context.args.slice(1).join(' ');

  const result = await skill.execute!(args, {});

  return {
    success: true,
    message: `Skill executed: ${skillName}`,
    data: result,
  };
};

export const skillInfoHandler: CommandHandler = async (context) => {
  const skillName = context.args[0];

  if (!skillName) {
    return {
      success: false,
      error: 'Missing required argument: skill name',
    };
  }

  const skill = context.skillRegistry.getSkill(skillName);

  if (!skill) {
    return {
      success: false,
      error: `Skill not found: ${skillName}`,
    };
  }

  return {
    success: true,
    data: {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      category: "general",
      author: skill.author,
      tags: [],
    },
  };
};

export const helpHandler: CommandHandler = async (context) => {
  const commands = context.agent ? [
    'execute <input>         Execute agent with input',
    'skill:list              List all available skills',
    'skill:invoke <name>     Invoke a skill by name',
    'skill:info <name>       Show skill information',
    'server:start            Start HTTP server',
    'server:stop             Stop HTTP server',
    'help                    Show this help message',
  ] : [];

  return {
    success: true,
    data: {
      commands,
      usage: 'nexus-cli <command> [args] [options]',
    },
  };
};

// Create default registry
export function createDefaultHandlers(): CommandHandlerRegistry {
  const registry = new CommandHandlerRegistry();

  registry.register('execute', executeHandler);
  registry.register('skill:list', skillListHandler);
  registry.register('skill:invoke', skillInvokeHandler);
  registry.register('skill:info', skillInfoHandler);
  registry.register('help', helpHandler);

  return registry;
}
