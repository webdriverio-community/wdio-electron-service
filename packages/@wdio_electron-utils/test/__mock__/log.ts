import { vi } from 'vitest';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
};

export const createLogger = vi.fn(() => mockLogger);

export default mockLogger;
