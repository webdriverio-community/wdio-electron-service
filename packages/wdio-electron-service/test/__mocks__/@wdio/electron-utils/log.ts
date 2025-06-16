import { vi } from 'vitest';

export default {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
};
