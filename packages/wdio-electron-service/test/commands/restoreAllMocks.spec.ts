import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { restoreAllMocks } from '../../src/commands/restoreAllMocks';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('restoreAllMocks Command', () => {
  let mockedGetName: any, mockedShowOpenDialog: any;

  beforeEach(async () => {
    mockedGetName = {
      getMockName: () => 'electron.app.getName',
      mockRestore: vi.fn(),
    };
    mockedShowOpenDialog = {
      getMockName: () => 'electron.dialog.showOpenDialog',
      mockRestore: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['electron.app.getName', mockedGetName],
      ['electron.dialog.showOpenDialog', mockedShowOpenDialog],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should restore all mock functions', async () => {
    await restoreAllMocks();
    expect(mockedGetName.mockRestore).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockRestore).toHaveBeenCalled();
  });

  it('should restore mock functions for a specific API', async () => {
    await restoreAllMocks('app');
    expect(mockedGetName.mockRestore).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockRestore).not.toHaveBeenCalled();
  });
});
