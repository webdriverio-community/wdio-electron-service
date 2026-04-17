import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, type LogLevel } from '../../../src/cli/logger.js';

describe('Logger', () => {
  let consoleSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // no-op
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // no-op
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor and static create', () => {
    it('should create logger with default normal level', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with specified level', () => {
      const logger = new Logger('verbose');
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create extra-verbose logger via static method', () => {
      const logger = Logger.create(false, true);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create verbose logger via static method', () => {
      const logger = Logger.create(true, false);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create normal logger via static method', () => {
      const logger = Logger.create(false, false);
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('basic output methods', () => {
    it.each(['normal', 'verbose', 'extra-verbose'] as LogLevel[])('should log info message for %s level', (level) => {
      const logger = new Logger(level);
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message');
    });

    it('should not log info message for silent level', () => {
      const logger = new Logger('silent');
      logger.info('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it.each([
      'normal',
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should log success message for %s level', (level) => {
      const logger = new Logger(level);
      logger.success('test success');
      expect(consoleSpy).toHaveBeenCalledWith('✅ test success');
    });

    it('should not log success message for silent level', () => {
      const logger = new Logger('silent');
      logger.success('test success');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it.each([
      'silent',
      'normal',
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should always log error message for %s level', (level) => {
      const logger = new Logger(level);
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ test error');
    });

    it.each([
      'normal',
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should log warning message for %s level', (level) => {
      const logger = new Logger(level);
      logger.warning('test warning');
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  test warning');
    });

    it('should not log warning message for silent level', () => {
      const logger = new Logger('silent');
      logger.warning('test warning');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('verbose-only output', () => {
    it('should log verbose message for verbose level', () => {
      const logger = new Logger('verbose');
      logger.verbose('verbose message');
      expect(consoleSpy).toHaveBeenCalledWith('verbose message');
    });

    it('should log verbose message for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.verbose('verbose message');
      expect(consoleSpy).toHaveBeenCalledWith('verbose message');
    });

    it.each(['silent', 'normal'] as LogLevel[])('should not log verbose message for %s level', (level) => {
      const logger = new Logger(level);
      logger.verbose('verbose message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('extra-verbose-only output', () => {
    it('should log extra verbose message for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.extraVerbose('extra verbose message');
      expect(consoleSpy).toHaveBeenCalledWith('extra verbose message');
    });

    it.each([
      'silent',
      'normal',
      'verbose',
    ] as LogLevel[])('should not log extra verbose message for %s level', (level) => {
      const logger = new Logger(level);
      logger.extraVerbose('extra verbose message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('section headers', () => {
    it.each(['verbose', 'extra-verbose'] as LogLevel[])('should log section for %s level', (level) => {
      const logger = new Logger(level);
      logger.section('Test Section');
      expect(consoleSpy).toHaveBeenCalledWith('\nTest Section');
    });

    it.each(['silent', 'normal'] as LogLevel[])('should not log section for %s level', (level) => {
      const logger = new Logger(level);
      logger.section('Test Section');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('detail messages', () => {
    it.each([
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should log detail with default indent for %s level', (level) => {
      const logger = new Logger(level);
      logger.detail('detail message');
      expect(consoleSpy).toHaveBeenCalledWith('   detail message');
    });

    it.each([
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should log detail with custom indent for %s level', (level) => {
      const logger = new Logger(level);
      logger.detail('detail message', 2);
      expect(consoleSpy).toHaveBeenCalledWith('      detail message');
    });

    it.each(['silent', 'normal'] as LogLevel[])('should not log detail for %s level', (level) => {
      const logger = new Logger(level);
      logger.detail('detail message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('extra detail messages', () => {
    it('should log extra detail with default indent for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.extraDetail('extra detail message');
      expect(consoleSpy).toHaveBeenCalledWith('   • extra detail message');
    });

    it('should log extra detail with custom indent for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.extraDetail('extra detail message', 2);
      expect(consoleSpy).toHaveBeenCalledWith('      • extra detail message');
    });

    it.each(['silent', 'normal', 'verbose'] as LogLevel[])('should not log extra detail for %s level', (level) => {
      const logger = new Logger(level);
      logger.extraDetail('extra detail message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('code output', () => {
    it('should log code with language for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.code('const x = 1;', 'javascript');
      expect(consoleSpy).toHaveBeenCalledWith('\n```javascript');
      expect(consoleSpy).toHaveBeenCalledWith('const x = 1;');
      expect(consoleSpy).toHaveBeenCalledWith('```\n');
    });

    it('should log code without language for extra-verbose level', () => {
      const logger = new Logger('extra-verbose');
      logger.code('const x = 1;');
      expect(consoleSpy).toHaveBeenCalledWith('\n```');
      expect(consoleSpy).toHaveBeenCalledWith('const x = 1;');
      expect(consoleSpy).toHaveBeenCalledWith('```\n');
    });

    it.each(['silent', 'normal', 'verbose'] as LogLevel[])('should not log code for %s level', (level) => {
      const logger = new Logger(level);
      logger.code('const x = 1;', 'javascript');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('dry run messaging', () => {
    it.each([
      'normal',
      'verbose',
      'extra-verbose',
    ] as LogLevel[])('should log dry run message for %s level', (level) => {
      const logger = new Logger(level);
      logger.dryRun('would do something');
      expect(consoleSpy).toHaveBeenCalledWith('🚫 Dry run - would do something');
    });

    it('should not log dry run message for silent level', () => {
      const logger = new Logger('silent');
      logger.dryRun('would do something');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it.each(['verbose', 'extra-verbose'] as LogLevel[])('should log progress for %s level', (level) => {
      const logger = new Logger(level);
      logger.progress('processing');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 processing...');
    });

    it.each(['silent', 'normal'] as LogLevel[])('should not log progress for %s level', (level) => {
      const logger = new Logger(level);
      logger.progress('processing');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('timed operations', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log timed operation success for verbose level', async () => {
      const logger = new Logger('verbose');
      const operation = vi.fn().mockResolvedValue('result');

      const promise = logger.timed('test operation', operation);
      vi.advanceTimersByTime(100);
      const result = await promise;

      expect(result).toBe('result');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 test operation...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ test operation completed');
    });

    it('should log timed operation success with duration for extra-verbose level', async () => {
      const logger = new Logger('extra-verbose');
      const operation = vi.fn().mockResolvedValue('result');

      const promise = logger.timed('test operation', operation);
      vi.advanceTimersByTime(150);
      const result = await promise;

      expect(result).toBe('result');
      expect(consoleSpy).toHaveBeenCalledWith('🔄 test operation...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ test operation completed (150ms)');
    });

    it('should log timed operation failure', async () => {
      const logger = new Logger('verbose');
      const error = new Error('operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      const promise = logger.timed('test operation', operation);
      vi.advanceTimersByTime(75);

      await expect(promise).rejects.toThrow('operation failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ test operation failed after 75ms:', error);
    });

    it('should not log for normal level', async () => {
      const logger = new Logger('normal');
      const operation = vi.fn().mockResolvedValue('result');

      const result = await logger.timed('test operation', operation);

      expect(result).toBe('result');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it.each(['normal', 'verbose', 'extra-verbose'] as LogLevel[])('should log summary for %s level', (level) => {
      const logger = new Logger(level);
      logger.summary('operation completed successfully');
      expect(consoleSpy).toHaveBeenCalledWith('\n💡 operation completed successfully');
    });

    it('should not log summary for silent level', () => {
      const logger = new Logger('silent');
      logger.summary('operation completed successfully');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
