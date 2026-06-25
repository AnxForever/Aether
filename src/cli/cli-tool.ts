/**
 * CLI Tool - Manual argument parsing and ANSI color output
 * Zero third-party dependencies
 */

export interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
}

export class CliTool {
  /**
   * Parse command line arguments manually
   * Format: <command> [args...] [--option=value] [--flag]
   */
  static parseArgs(argv: string[]): ParsedArgs {
    // Skip node and script path (first 2 args)
    const rawArgs = argv.slice(2);

    if (rawArgs.length === 0) {
      return {
        command: 'help',
        args: [],
        options: {},
      };
    }

    const command = rawArgs[0];
    const args: string[] = [];
    const options: Record<string, string | boolean> = {};

    for (let i = 1; i < rawArgs.length; i++) {
      const arg = rawArgs[i];

      if (arg.startsWith('--')) {
        // Long option: --option=value or --flag
        const optionStr = arg.slice(2);
        const equalIndex = optionStr.indexOf('=');

        if (equalIndex !== -1) {
          const key = optionStr.slice(0, equalIndex);
          const value = optionStr.slice(equalIndex + 1);
          options[key] = value;
        } else {
          options[optionStr] = true;
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        // Short option: -f
        const key = arg.slice(1);
        options[key] = true;
      } else {
        // Regular argument
        args.push(arg);
      }
    }

    return { command, args, options };
  }

  /**
   * ANSI color codes
   */
  static readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
  };

  /**
   * Color helper methods
   */
  static red(text: string): string {
    return `${this.colors.red}${text}${this.colors.reset}`;
  }

  static green(text: string): string {
    return `${this.colors.green}${text}${this.colors.reset}`;
  }

  static yellow(text: string): string {
    return `${this.colors.yellow}${text}${this.colors.reset}`;
  }

  static blue(text: string): string {
    return `${this.colors.blue}${text}${this.colors.reset}`;
  }

  static magenta(text: string): string {
    return `${this.colors.magenta}${text}${this.colors.reset}`;
  }

  static cyan(text: string): string {
    return `${this.colors.cyan}${text}${this.colors.reset}`;
  }

  static gray(text: string): string {
    return `${this.colors.gray}${text}${this.colors.reset}`;
  }

  static bold(text: string): string {
    return `${this.colors.bright}${text}${this.colors.reset}`;
  }

  static dim(text: string): string {
    return `${this.colors.dim}${text}${this.colors.reset}`;
  }

  /**
   * Status indicator helpers
   */
  static success(message: string): void {
    console.log(`${this.colors.green}✓${this.colors.reset} ${message}`);
  }

  static error(message: string): void {
    console.error(`${this.colors.red}✗${this.colors.reset} ${message}`);
  }

  static info(message: string): void {
    console.log(`${this.colors.blue}ℹ${this.colors.reset} ${message}`);
  }

  static warn(message: string): void {
    console.warn(`${this.colors.yellow}⚠${this.colors.reset} ${message}`);
  }

  /**
   * Box drawing
   */
  static box(content: string, title?: string): void {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length), title ? title.length : 0);
    const width = maxLength + 4;

    const top = title
      ? `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 5))}┐`
      : `┌${'─'.repeat(width)}┐`;

    const bottom = `└${'─'.repeat(width)}┘`;

    console.log(this.cyan(top));
    for (const line of lines) {
      const padding = ' '.repeat(Math.max(0, maxLength - line.length));
      console.log(`${this.cyan('│')}  ${line}${padding}  ${this.cyan('│')}`);
    }
    console.log(this.cyan(bottom));
  }

  /**
   * Table rendering
   */
  static table(headers: string[], rows: string[][]): void {
    const colWidths = headers.map((h, i) => {
      const cellWidths = rows.map(row => (row[i] || '').length);
      return Math.max(h.length, ...cellWidths);
    });

    // Header
    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' │ ');
    console.log(this.bold(headerRow));
    console.log('─'.repeat(headerRow.length));

    // Rows
    for (const row of rows) {
      const rowStr = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' │ ');
      console.log(rowStr);
    }
  }

  /**
   * Progress spinner
   */
  static spinner(message: string): () => void {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let running = true;

    const interval = setInterval(() => {
      if (!running) return;
      process.stdout.write(`\r${this.cyan(frames[i])} ${message}`);
      i = (i + 1) % frames.length;
    }, 80);

    return () => {
      running = false;
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(message.length + 3) + '\r');
    };
  }

  /**
   * JSON pretty print with colors
   */
  static jsonPretty(obj: unknown): void {
    const json = JSON.stringify(obj, null, 2);
    const colored = json
      .replace(/"([^"]+)":/g, (_, key) => `${this.cyan(`"${key}"`)}:`)
      .replace(/: "([^"]*)"/g, (_, val) => `: ${this.green(`"${val}"`)}`)
      .replace(/: (\d+)/g, (_, num) => `: ${this.yellow(num)}`)
      .replace(/: (true|false)/g, (_, bool) => `: ${this.magenta(bool)}`)
      .replace(/: null/g, `: ${this.gray('null')}`);

    console.log(colored);
  }

  /**
   * Banner
   */
  static banner(text: string): void {
    console.log();
    console.log(this.bold(this.cyan(text)));
    console.log(this.cyan('═'.repeat(text.length)));
    console.log();
  }

  /**
   * Section header
   */
  static section(text: string): void {
    console.log();
    console.log(this.bold(text));
    console.log('─'.repeat(text.length));
  }

  /**
   * List items
   */
  static list(items: string[], bullet: string = '•'): void {
    for (const item of items) {
      console.log(`  ${this.cyan(bullet)} ${item}`);
    }
  }

  /**
   * Key-value pairs
   */
  static keyValue(pairs: Record<string, string>): void {
    const maxKeyLength = Math.max(...Object.keys(pairs).map(k => k.length));

    for (const [key, value] of Object.entries(pairs)) {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`  ${this.dim(paddedKey)} ${this.cyan('│')} ${value}`);
    }
  }
}
