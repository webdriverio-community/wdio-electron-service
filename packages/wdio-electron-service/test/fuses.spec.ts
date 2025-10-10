import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from '@electron/fuses';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInspectFuse } from '../src/fuses.js';

vi.mock('@electron/fuses', () => ({
  FuseState: {
    ENABLE: 49,
    DISABLE: 48,
    REMOVED: 114,
    INHERIT: 144,
  },
  FuseV1Options: {
    EnableNodeCliInspectArguments: 3,
  },
  FuseVersion: {
    V1: '1',
  },
  getCurrentFuseWire: vi.fn(),
}));

vi.mock('@wdio/electron-utils', () => import('./mocks/electron-utils.js'));

describe('fuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkInspectFuse', () => {
    it('should return canUseCdpBridge: true when no fuse config is found', async () => {
      vi.mocked(getCurrentFuseWire).mockResolvedValue(null);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result).toEqual({
        canUseCdpBridge: true,
      });
    });

    it('should return canUseCdpBridge: true when fuse is enabled', async () => {
      vi.mocked(getCurrentFuseWire).mockResolvedValue({
        version: FuseVersion.V1,
        [FuseV1Options.EnableNodeCliInspectArguments]: FuseState.ENABLE,
      } as any);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result).toEqual({
        canUseCdpBridge: true,
        fuseValue: FuseState.ENABLE,
      });
    });

    it('should return canUseCdpBridge: true when fuse is inherited (default)', async () => {
      vi.mocked(getCurrentFuseWire).mockResolvedValue({
        version: FuseVersion.V1,
        [FuseV1Options.EnableNodeCliInspectArguments]: FuseState.INHERIT,
      } as any);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result).toEqual({
        canUseCdpBridge: true,
        fuseValue: FuseState.INHERIT,
      });
    });

    it('should return canUseCdpBridge: false when fuse is disabled', async () => {
      vi.mocked(getCurrentFuseWire).mockResolvedValue({
        version: FuseVersion.V1,
        [FuseV1Options.EnableNodeCliInspectArguments]: FuseState.DISABLE,
      } as any);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result.canUseCdpBridge).toBe(false);
      expect(result.fuseValue).toBe(FuseState.DISABLE);
      expect(result.error).toBeUndefined();
    });

    it('should return canUseCdpBridge: true when no V1 fuses are present', async () => {
      vi.mocked(getCurrentFuseWire).mockResolvedValue({} as any);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result).toEqual({
        canUseCdpBridge: true,
      });
    });

    it('should return canUseCdpBridge: true with error message when reading fuses fails', async () => {
      const error = new Error('Failed to read binary');
      vi.mocked(getCurrentFuseWire).mockRejectedValue(error);

      const result = await checkInspectFuse('/path/to/electron');

      expect(result.canUseCdpBridge).toBe(true);
      expect(result.error).toContain('Could not verify fuse configuration');
      expect(result.error).toContain('Failed to read binary');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      vi.mocked(getCurrentFuseWire).mockRejectedValue('string error');

      const result = await checkInspectFuse('/path/to/electron');

      expect(result.canUseCdpBridge).toBe(true);
      expect(result.error).toContain('Could not verify fuse configuration');
      expect(result.error).toContain('string error');
    });
  });
});
