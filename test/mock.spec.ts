/// <reference types="../../@types/vitest" />
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { createMock } from '../src/mock.js';

beforeEach(() => {
  globalThis.fn = vi.fn;
  globalThis.browser = {
    electron: {
      execute: vi.fn(),
    },
  } as unknown as WebdriverIO.Browser;
});

describe('createMock', () => {
  it('should create a mock with the expected name', async () => {
    const mock = await createMock('app', 'getName');

    expect(mock.getMockName()).toBe('electron.app.getName');
  });

  it('should create a mock with the expected methods', async () => {
    const mock = await createMock('app', 'getName');

    expect(mock.mockImplementation).toStrictEqual(expect.any(Function));
    expect(mock.mockImplementationOnce).toStrictEqual(expect.any(Function));
    expect(mock.mockReturnValue).toStrictEqual(expect.any(Function));
    expect(mock.mockReturnValueOnce).toStrictEqual(expect.any(Function));
    expect(mock.mockResolvedValue).toStrictEqual(expect.any(Function));
    expect(mock.mockResolvedValueOnce).toStrictEqual(expect.any(Function));
    expect(mock.mockRejectedValue).toStrictEqual(expect.any(Function));
    expect(mock.mockRejectedValueOnce).toStrictEqual(expect.any(Function));
    expect(mock.mockClear).toStrictEqual(expect.any(Function));
    expect(mock.mockReset).toStrictEqual(expect.any(Function));
    expect(mock.mockRestore).toStrictEqual(expect.any(Function));
    expect(mock.update).toStrictEqual(expect.any(Function));
  });

  it('should initialise the inner mock', async () => {
    await createMock('app', 'getName');
    const executeCalls = (globalThis.browser.electron.execute as Mock).mock.calls;
    const executeFn = executeCalls[0][0];
    const apiName = executeCalls[0][1];
    const funcName = executeCalls[0][2];
    const electron = { app: { getName: () => 'not a mock' } };
    // TODO extract to processExecuteCalls - for a given electron object
    executeFn(electron, apiName, funcName);

    expect(electron.app.getName).toStrictEqual(expect.anyMockFunction());
  });
});
