/// <reference types="../../@types/vitest" />
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { createMock } from '../src/mock.js';
import { ElectronInterface, ElectronType } from '../src/types.js';

type ElectronMockExecuteFn = (
  electron: Partial<ElectronType>,
  apiName: string,
  funcName: string,
  ...additionalArgs: unknown[]
) => void;
type ElectronObj = Partial<Omit<ElectronType[ElectronInterface], 'on'>>;
type ExecuteCalls = [
  executeFn: ElectronMockExecuteFn,
  apiName: string,
  funcName: string,
  ...additionalArgs: unknown[],
][];

function processExecuteCalls(electron: ElectronObj) {
  const executeCalls = (globalThis.browser.electron.execute as Mock).mock.calls as ExecuteCalls;

  for (const executeCall of executeCalls) {
    const [executeFn, apiName, funcName, ...additionalArgs] = executeCall;
    executeFn(electron, apiName, funcName, ...additionalArgs);
  }
}

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
    const electron = { app: { getName: () => 'not a mock' } as Omit<ElectronType['app'], 'on'> };
    processExecuteCalls(electron);

    expect(electron.app.getName).toStrictEqual(expect.anyMockFunction());
  });

  describe('mockImplementation', () => {
    it('should set mockImplementation of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'not a mock' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockImplementation(() => 'mock implementation');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('mock implementation');
    });

    // TODO: outerMockImpl
  });

  describe('mockImplementationOnce', () => {
    it('should set mockImplementationOnce of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'not a mock' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockImplementation(() => 'default mock implementation');
      await mock.mockImplementationOnce(() => 'first mock implementation');
      await mock.mockImplementationOnce(() => 'second mock implementation');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('first mock implementation');
      expect(electron.app.getName()).toBe('second mock implementation');
      expect(electron.app.getName()).toBe('default mock implementation');
    });

    // TODO: outerMockImplOnce
  });
});
