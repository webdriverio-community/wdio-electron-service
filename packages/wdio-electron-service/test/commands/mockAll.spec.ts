/// <reference types="../../@types/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockAll } from '../../src/commands/mockAll.js';

describe('mockAll Command', () => {
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
    expect(mockedDialog).toStrictEqual({
      showOpenDialogSync: expect.anyMockFunction(),
      showOpenDialog: expect.anyMockFunction(),
      showSaveDialogSync: expect.anyMockFunction(),
      showSaveDialog: expect.anyMockFunction(),
      showMessageBoxSync: expect.anyMockFunction(),
      showMessageBox: expect.anyMockFunction(),
      showErrorBox: expect.anyMockFunction(),
      showCertificateTrustDialog: expect.anyMockFunction(),
    });
  });
});
