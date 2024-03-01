import { vi } from 'vitest';
import { ElectronMockInstance } from 'src/types.js';

export function isMockFunction(fn: unknown): fn is ElectronMockInstance {
  return vi.isMockFunction(fn) && '__isElectronMock' in fn;
}
