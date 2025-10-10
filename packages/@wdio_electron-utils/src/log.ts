import logger, { type Logger } from '@wdio/logger';
import debug from 'debug';

export type LogArea = 'service' | 'launcher' | 'bridge' | 'mock' | 'bundler' | 'config' | 'utils' | 'e2e' | 'fuses';

// Handle CommonJS/ESM compatibility for @wdio/logger default export
const createWdioLogger = (logger as unknown as { default: typeof logger }).default || logger;

const areaCache = new Map<string, Logger>();

export function createLogger(area?: LogArea): Logger {
  const areaKey = area ?? '';
  const cached = areaCache.get(areaKey);
  if (cached) return cached;
  const areaSuffix = area ? `:${area}` : '';
  const areaDebug = debug(`wdio-electron-service${areaSuffix}`);
  const areaLogger = createWdioLogger(`electron-service${areaSuffix}`);

  const wrapped: Logger = {
    ...areaLogger,
    debug: (...args: unknown[]) => {
      // Always forward to @wdio/logger so WDIO runner captures debug logs in outputDir
      // This ensures logs appear in CI log artifacts, not only in live console
      try {
        (areaLogger.debug as unknown as (...a: unknown[]) => void)(...args);
      } catch {
        console.log('🔍 DEBUG: Error in debug logger', args);
      }

      if (typeof args.at(-1) === 'object') {
        if (args.length > 1) {
          areaDebug(args.slice(0, -1));
        }
        areaDebug('%O', args.at(-1));
      } else {
        areaDebug(args);
      }
    },
  };

  areaCache.set(areaKey, wrapped);
  return wrapped;
}
