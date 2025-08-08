import logger, { type Logger } from '@wdio/logger';
import debug from 'debug';

export type LogArea = 'service' | 'launcher' | 'bridge' | 'mock' | 'bundler' | 'config' | 'utils' | 'e2e';

const areaCache = new Map<string, Logger>();

export function createLogger(area?: LogArea): Logger {
  const areaKey = area ?? '';
  const cached = areaCache.get(areaKey);
  if (cached) return cached;
  const areaSuffix = area ? `:${area}` : '';
  const areaDebug = debug(`wdio-electron-service${areaSuffix}`);
  const areaLogger = logger(`electron-service${areaSuffix}`);

  const wrapped: Logger = {
    ...areaLogger,
    debug: (...args: unknown[]) => {
      if (typeof args.at(-1) === 'object') {
        if (args.length > 1) {
          areaDebug(args.slice(0, -1));
        }
        areaDebug('%O', args.at(-1));
      } else {
        areaDebug(args);
      }
      // Also forward to @wdio/logger for unified sinks
      areaLogger.debug(...args);
    },
  };

  areaCache.set(areaKey, wrapped);
  return wrapped;
}
