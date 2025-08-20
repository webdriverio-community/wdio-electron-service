import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { resetAllMocks } from '../../src/commands/resetAllMocks.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('resetAllMocks Command', () => {
  let mockedGetName: any, mockedShowOpenDialog: any;

  beforeEach(async () => {
    mockedGetName = {
      getMockName: () => 'electron.app.getName',
      mockReset: vi.fn(),
    };
    mockedShowOpenDialog = {
      getMockName: () => 'electron.dialog.showOpenDialog',
      mockReset: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['electron.app.getName', mockedGetName],
      ['electron.dialog.showOpenDialog', mockedShowOpenDialog],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reset the expected mock functions', async () => {
    await resetAllMocks('app');
    expect(mockedGetName.mockReset).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockReset).not.toHaveBeenCalled();
  });

  it('should reset all mock functions when no apiName is specified', async () => {
    await resetAllMocks();
    expect(mockedGetName.mockReset).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockReset).toHaveBeenCalled();
  });
});
