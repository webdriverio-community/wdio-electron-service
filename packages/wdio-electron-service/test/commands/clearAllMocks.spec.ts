import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { clearAllMocks } from '../../src/commands/clearAllMocks.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('clearAllMocks Command', () => {
  let mockedGetName: any, mockedShowOpenDialog: any;

  beforeEach(async () => {
    mockedGetName = {
      getMockName: () => 'electron.app.getName',
      mockClear: vi.fn(),
    };
    mockedShowOpenDialog = {
      getMockName: () => 'electron.dialog.showOpenDialog',
      mockClear: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['electron.app.getName', mockedGetName],
      ['electron.dialog.showOpenDialog', mockedShowOpenDialog],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should clear all mock functions', async () => {
    await clearAllMocks();
    expect(mockedGetName.mockClear).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockClear).toHaveBeenCalled();
  });

  it('should clear mock functions for a specific API', async () => {
    await clearAllMocks('app');
    expect(mockedGetName.mockClear).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockClear).not.toHaveBeenCalled();
  });
});
