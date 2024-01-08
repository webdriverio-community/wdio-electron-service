import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { mockAll } from '../../src/commands/mockAll.js';

describe('mockAll', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {
        execute: vi
          .fn()
          .mockReturnValue(
            'showOpenDialogSync,showOpenDialog,showSaveDialogSync,showSaveDialog,showMessageBoxSync,showMessageBox,showErrorBox,showCertificateTrustDialog',
          ),
      },
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return mock functions for all API methods', async () => {
    const mockedDialog = await mockAll('dialog');
    expect(mockedDialog.showOpenDialogSync.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showOpenDialog.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showSaveDialogSync.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showSaveDialog.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showMessageBoxSync.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showMessageBox.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showErrorBox.mock.calls).toStrictEqual([]);
    expect(mockedDialog.showCertificateTrustDialog.mock.calls).toStrictEqual([]);
  });
});
