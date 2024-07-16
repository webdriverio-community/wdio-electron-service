import type { ElectronMockInstance } from '@repo/types';

export function isMockFunction(fn: unknown): fn is ElectronMockInstance {
  return (
    typeof fn === 'function' && '__isElectronMock' in fn && (fn as unknown as ElectronMockInstance).__isElectronMock
  );
}
