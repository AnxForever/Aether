import { PiAgentAdapter } from '../agent/pi-adapter';
import { SkillRegistry } from '../skills/registry';
import { HttpServer, HttpServerConfig } from './http-server';
import { CommandHandlerRegistry, createDefaultHandlers, CommandContext, CommandResult } from './command-handler';
import { CliTool, ParsedArgs } from './cli-tool';

export interface CliManagerConfig {
  httpServer?: HttpServerConfig;
}

export class CliManager {
  private agent: PiAgentAdapter;
  private skillRegistry: SkillRegistry;
  private httpServer: HttpServer | null = null;
  private commandRegistry: CommandHandlerRegistry;
  private config: CliManagerConfig;

  constructor(
    agent: PiAgentAdapter,
    skillRegistry: SkillRegistry,
    config: CliManagerConfig = {}
  ) {
    this.agent = agent;
    this.skillRegistry = skillRegistry;
    this.config = config;
    this.commandRegistry = createDefaultHandlers();

    // Register server commands
    this.commandRegistry.register('server:start', this.handleServerStart.bind(this));
    this.commandRegistry.register('server:stop', this.handleServerStop.bind(this));
    this.commandRegistry.register('server:status', this.handleServerStatus.bind(this));
  }

  /**
   * Execute command from parsed arguments
   */
  async executeCommand(parsed: ParsedArgs): Promise<CommandResult> {
    const context: CommandContext = {
      agent: this.agent,
      skillRegistry: this.skillRegistry,
      args: parsed.args,
      options: parsed.options,
    };

    return await this.commandRegistry.execute(parsed.command, context);
  }

  /**
   * Run CLI with process.argv
   */
  async run(argv: string[] = process.argv): Promise<void> {
    const parsed = CliTool.parseArgs(argv);

    CliTool.banner('Aether CLI');

    // Display command info
    if (parsed.options.verbose) {
      CliTool.info(`Command: ${CliTool.cyan(parsed.command)}`);
      if (parsed.args.length > 0) {
        CliTool.info(`Args: ${CliTool.gray(parsed.args.join(', '))}`);
      }
      if (Object.keys(parsed.options).length > 0) {
        CliTool.info(`Options: ${CliTool.gray(JSON.stringify(parsed.options))}`);
      }
      console.log();
    }

    // Execute command
    const stopSpinner = CliTool.spinner('Executing...');

    try {
      const result = await this.executeCommand(parsed);
      stopSpinner();

      if (result.success) {
        this.handleSuccess(result);
      } else {
        this.handleError(result);
        process.exit(1);
      }
    } catch (error) {
      stopSpinner();
      CliTool.error('Unexpected error occurred');
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Handle successful command result
   */
  private handleSuccess(result: CommandResult): void {
    if (result.message) {
      CliTool.success(result.message);
    }

    if (result.data) {
      console.log();

      // Special formatting for different data types
      if (Array.isArray(result.data)) {
        this.formatArrayData(result.data);
      } else if (typeof result.data === 'object' && result.data !== null) {
        this.formatObjectData(result.data);
      } else {
        console.log(result.data);
      }
    }

    console.log();
  }

  /**
   * Handle error result
   */
  private handleError(result: CommandResult): void {
    CliTool.error(result.error || 'Command failed');
    console.log();
  }

  /**
   * Format array data (e.g., skill list)
   */
  private formatArrayData(data: unknown[]): void {
    if (data.length === 0) {
      CliTool.info('No items found');
      return;
    }

    // Check if array contains objects with common structure
    if (typeof data[0] === 'object' && data[0] !== null) {
      const firstItem = data[0] as Record<string, unknown>;

      // Special handling for skills
      if ('name' in firstItem && 'description' in firstItem) {
        this.formatSkillList(data as Array<{ name: string; description: string; category?: string }>);
        return;
      }

      // Generic table format for objects
      const keys = Object.keys(firstItem);
      const rows = data.map(item => {
        const obj = item as Record<string, unknown>;
        return keys.map(key => String(obj[key] ?? ''));
      });

      CliTool.table(keys, rows);
    } else {
      // Simple list
      CliTool.list(data.map(String));
    }
  }

  /**
   * Format skill list
   */
  private formatSkillList(skills: Array<{ name: string; description: string; category?: string }>): void {
    CliTool.section('Available Skills');
    console.log();

    for (const skill of skills) {
      console.log(`  ${CliTool.bold(CliTool.cyan(skill.name))}`);
      console.log(`  ${CliTool.dim(skill.description)}`);
      if (skill.category) {
        console.log(`  ${CliTool.gray(`[${skill.category}]`)}`);
      }
      console.log();
    }

    CliTool.info(`Total: ${skills.length} skills`);
  }

  /**
   * Format object data
   */
  private formatObjectData(data: object): void {
    const obj = data as Record<string, unknown>;

    // Check if it's a commands list (from help)
    if ('commands' in obj && Array.isArray(obj.commands)) {
      CliTool.section('Available Commands');
      console.log();
      CliTool.list(obj.commands as string[]);

      if ('usage' in obj) {
        console.log();
        CliTool.info(`Usage: ${obj.usage}`);
      }
      return;
    }

    // Check if it's skill info
    if ('name' in obj && 'description' in obj && 'version' in obj) {
      CliTool.section('Skill Information');
      console.log();

      const pairs: Record<string, string> = {
        'Name': String(obj.name),
        'Description': String(obj.description),
        'Version': String(obj.version),
      };

      if ('category' in obj) {
        pairs['Category'] = String(obj.category);
      }
      if ('author' in obj) {
        pairs['Author'] = String(obj.author);
      }
      if ('tags' in obj && Array.isArray(obj.tags)) {
        pairs['Tags'] = (obj.tags as string[]).join(', ');
      }

      CliTool.keyValue(pairs);
      return;
    }

    // Default: pretty JSON
    CliTool.jsonPretty(data);
  }

  /**
   * Server command handlers
   */
  private async handleServerStart(context: CommandContext): Promise<CommandResult> {
    if (this.httpServer) {
      return {
        success: false,
        error: 'HTTP server is already running',
      };
    }

    const port = parseInt(context.options.port as string) || this.config.httpServer?.port || 3000;
    const host = (context.options.host as string) || this.config.httpServer?.host || '127.0.0.1';

    this.httpServer = new HttpServer(this.agent, this.skillRegistry, { port, host });

    await this.httpServer.start();
    this.httpServer.startSessionCleanup();

    return {
      success: true,
      message: `HTTP server started`,
      data: {
        url: `http://${host}:${port}`,
        endpoints: [
          'POST /api/agent/execute',
          'POST /api/agent/continue',
          'POST /api/agent/abort',
          'GET  /api/agent/status/:id',
          'POST /api/skills/invoke',
          'GET  /api/skills/list',
          'GET  /health',
        ],
      },
    };
  }

  private async handleServerStop(context: CommandContext): Promise<CommandResult> {
    if (!this.httpServer) {
      return {
        success: false,
        error: 'HTTP server is not running',
      };
    }

    await this.httpServer.stop();
    this.httpServer = null;

    return {
      success: true,
      message: 'HTTP server stopped',
    };
  }

  private async handleServerStatus(context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      data: {
        running: this.httpServer !== null,
      },
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.httpServer) {
      await this.httpServer.stop();
      this.httpServer = null;
    }
  }
}
