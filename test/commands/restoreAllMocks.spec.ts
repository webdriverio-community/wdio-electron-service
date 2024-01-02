import { vi, describe, beforeEach, it, expect } from 'vitest';

import { restoreAllMocks } from '../../src/commands/restoreAllMocks';
import mockStore from '../../src/mockStore.js';
import type { AsyncMock } from '../../src/mock.js';

describe('restoreAllMocks', () => {
  let mockedGetName, mockedShowOpenDialog;

  beforeEach(async () => {
    mockedGetName = { getMockName: () => 'electron.app.getName', mockRestore: vi.fn() };
    mockedShowOpenDialog = {
      getMockName: () => 'electron.dialog.showOpenDialog',
      mockRestore: vi.fn(),
    };
    mockStore.setMock(mockedGetName as unknown as AsyncMock);
    mockStore.setMock(mockedShowOpenDialog as unknown as AsyncMock);
  });

  it('should remove the expected mock functions', async () => {
    await restoreAllMocks('app');
    expect(mockedGetName.mockRestore).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockRestore).not.toHaveBeenCalled();
  });

  it('should remove all mock functions when no apiName is specified', async () => {
    await restoreAllMocks();
    expect(mockedGetName.mockRestore).toHaveBeenCalled();
    expect(mockedShowOpenDialog.mockRestore).toHaveBeenCalled();
  });
});
