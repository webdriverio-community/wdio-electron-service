import { vi, describe, beforeEach, it, expect, Mock, afterEach } from 'vitest';

import { restoreAllMocks } from '../../src/commands/restoreAllMocks';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
    removeMock: vi.fn(),
  },
}));

describe('restoreAllMocks', () => {
  let mockedGetName, mockedShowOpenDialog;

  beforeEach(async () => {
    mockedGetName = { getMockName: () => 'electron.app.getName', mockRestore: vi.fn() };
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

  it('should remove restored mock functions from the store', async () => {
    await restoreAllMocks();
    expect(mockStore.removeMock).toHaveBeenCalledWith('electron.app.getName');
    expect(mockStore.removeMock).toHaveBeenCalledWith('electron.dialog.showOpenDialog');
  });

  it('should restore mock functions for a specific API', async () => {
    await restoreAllMocks('app');
    expect(mockedGetName.mockRestore).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockRestore).not.toHaveBeenCalled();
  });

  it('should remove restored mock functions from the store for a specific API', async () => {
    await restoreAllMocks('app');
    expect(mockStore.removeMock).toHaveBeenCalledWith('electron.app.getName');
    expect(mockStore.removeMock).not.toHaveBeenCalledWith('electron.dialog.showOpenDialog');
  });
});
