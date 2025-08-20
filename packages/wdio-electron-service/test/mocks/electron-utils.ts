// Comprehensive mock for @wdio/electron-utils
import { vi } from 'vitest';

type LogArea = 'service' | 'launcher' | 'bridge' | 'mock' | 'bundler' | 'config' | 'utils' | 'e2e';

// Create mock logger instances for different areas
const mockLoggers = new Map<string, any>();

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
});

export const createLogger = vi.fn((area?: LogArea) => {
  const key = area || 'default';
  if (!mockLoggers.has(key)) {
    mockLoggers.set(key, createMockLogger());
  }
  const logger = mockLoggers.get(key);
  if (!logger) {
    throw new Error(`Mock logger not found for area: ${key}`);
  }
  return logger;
});

// Export getter functions to access specific mock loggers in tests
export const getMockLogger = (area?: LogArea) => {
  const key = area || 'default';
  return mockLoggers.get(key);
};

export const clearAllMockLoggers = () => {
  for (const mockLogger of mockLoggers.values()) {
    Object.values(mockLogger).forEach((fn) => {
      if (vi.isMockFunction(fn)) {
        fn.mockClear();
      }
    });
  }
};

// Re-export any additional mocks that tests might need
export const getBinaryPath = vi.fn();
export const getAppBuildInfo = vi.fn();
export const getElectronVersion = vi.fn();
