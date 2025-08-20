export type LogLevel = 'silent' | 'normal' | 'verbose' | 'extra-verbose';

export class Logger {
  constructor(private level: LogLevel = 'normal') {}

  static create(verbose?: boolean, extraVerbose?: boolean): Logger {
    if (extraVerbose) return new Logger('extra-verbose');
    if (verbose) return new Logger('verbose');
    return new Logger('normal');
  }

  // Basic output methods
  info(message: string): void {
    if (this.level !== 'silent') {
      console.log(message);
    }
  }

  success(message: string): void {
    if (this.level !== 'silent') {
      console.log(`✅ ${message}`);
    }
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  warning(message: string): void {
    if (this.level !== 'silent') {
      console.log(`⚠️  ${message}`);
    }
  }

  // Verbose-only output
  verbose(message: string): void {
    if (this.level === 'verbose' || this.level === 'extra-verbose') {
      console.log(message);
    }
  }

  // Extra verbose-only output
  extraVerbose(message: string): void {
    if (this.level === 'extra-verbose') {
      console.log(message);
    }
  }

  // Section headers for verbose output
  section(title: string): void {
    if (this.level === 'verbose' || this.level === 'extra-verbose') {
      console.log(`\n${title}`);
    }
  }

  // Indented information for verbose output
  detail(message: string, indent: number = 1): void {
    if (this.level === 'verbose' || this.level === 'extra-verbose') {
      const spaces = '   '.repeat(indent);
      console.log(`${spaces}${message}`);
    }
  }

  // Extra verbose details
  extraDetail(message: string, indent: number = 1): void {
    if (this.level === 'extra-verbose') {
      const spaces = '   '.repeat(indent);
      console.log(`${spaces}• ${message}`);
    }
  }

  // Code/JSON output with syntax highlighting
  code(content: string, language?: string): void {
    if (this.level === 'extra-verbose') {
      console.log(`\n\`\`\`${language || ''}`);
      console.log(content);
      console.log('```\n');
    }
  }

  // Dry run specific messaging
  dryRun(message: string): void {
    if (this.level !== 'silent') {
      console.log(`🚫 Dry run - ${message}`);
    }
  }

  // Progress tracking for longer operations
  progress(message: string): void {
    if (this.level === 'verbose' || this.level === 'extra-verbose') {
      console.log(`🔄 ${message}...`);
    }
  }

  // Helper for measuring operation time
  async timed<T>(message: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();

    if (this.level === 'verbose' || this.level === 'extra-verbose') {
      console.log(`🔄 ${message}...`);
    }

    try {
      const result = await operation();
      const duration = Date.now() - start;

      if (this.level === 'extra-verbose') {
        console.log(`✅ ${message} completed (${duration}ms)`);
      } else if (this.level === 'verbose') {
        console.log(`✅ ${message} completed`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ ${message} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  // Final summary
  summary(message: string): void {
    if (this.level !== 'silent') {
      console.log(`\n💡 ${message}`);
    }
  }
}
