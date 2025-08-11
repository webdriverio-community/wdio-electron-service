/// <reference types="../../../@types/vitest/index.d.ts" />
import { isAsyncFunction } from 'node:util/types';
import type { ElectronInterface, ElectronType } from '@wdio/electron-types';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { createMock } from '../src/mock.js';

let mockFn: Mock;
let mockExecute: Mock;

vi.doMock('@vitest/spy', () => ({
  fn: () => mockFn,
}));
vi.mock('../src/commands/execute', () => {
  return {
    execute: vi.fn(),
  };
});

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

async function processExecuteCalls(electron: ElectronObj) {
  const executeCalls = (globalThis.browser.electron.execute as Mock).mock.calls as ExecuteCalls;
  const asyncExecuteCalls = executeCalls.filter(([executeFn]) => isAsyncFunction(executeFn));
  const syncExecuteCalls = executeCalls.filter(([executeFn]) => !isAsyncFunction(executeFn));

  // clear the mock
  (globalThis.browser.electron.execute as Mock).mockClear();

  // process sync calls
  for (const executeCall of syncExecuteCalls) {
    const [executeFn, apiName, funcName, ...additionalArgs] = executeCall;
    executeFn(electron, apiName, funcName, ...additionalArgs);
  }

  // process async calls
  return asyncExecuteCalls.length > 0
    ? Promise.all(
        asyncExecuteCalls.map(([executeFn, apiName, funcName, ...additionalArgs]) =>
          executeFn(electron, apiName, funcName, ...additionalArgs),
        ),
      )
    : Promise.resolve();
}

beforeEach(() => {
  mockFn = vi.fn();
  mockExecute = vi.fn();
  globalThis.browser = {
    electron: {
      execute: mockExecute,
    },
  } as unknown as WebdriverIO.Browser;
});

describe('Mock API', () => {
  describe('createMock()', () => {
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
      const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
      await processExecuteCalls(electron);

      expect(electron.app.getName).toStrictEqual(expect.anyMockFunction());
    });

    describe('update', () => {
      it('should update according to the status of the inner mock', async () => {
        const mock = await createMock('app', 'getFileIcon');
        mockExecute.mockImplementation((fn, apiName, funcName) => {
          return fn(
            {
              app: {
                getFileIcon: {
                  mock: {
                    calls: [['/path/to/another/icon', { size: 'small' }]],
                  },
                },
              },
            },
            apiName,
            funcName,
          );
        });
        await mock.update();
        const returnedMock = mock as unknown as Mock;

        expect(returnedMock).toHaveBeenCalledTimes(1);
        expect(returnedMock).toHaveBeenCalledWith('/path/to/another/icon', { size: 'small' });
      });

      it('should update according to the empty calls', async () => {
        const mock = await createMock('app', 'getFileIcon');
        mockExecute.mockImplementation((fn, apiName, funcName) => {
          return fn(
            {
              app: {
                getFileIcon: {},
              },
            },
            apiName,
            funcName,
          );
        });
        await mock.update();
        const returnedMock = mock as unknown as Mock;

        expect(returnedMock).toHaveBeenCalledTimes(0);
      });
    });

    describe('mockImplementation', () => {
      it('should set mockImplementation of the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
        await processExecuteCalls(electron);
        await mock.mockImplementation(() => 'mock implementation');
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('mock implementation');
      });
    });

    describe('mockImplementationOnce', () => {
      it('should set mockImplementationOnce of the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
        await processExecuteCalls(electron);
        await mock.mockImplementation(() => 'default mock implementation');
        await mock.mockImplementationOnce(() => 'first mock implementation');
        await mock.mockImplementationOnce(() => 'second mock implementation');
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('first mock implementation');
        expect(electron.app.getName()).toBe('second mock implementation');
        expect(electron.app.getName()).toBe('default mock implementation');
        expect(electron.app.getName()).toBe('default mock implementation');
      });
    });

    describe('mockReturnValue', () => {
      it('should set mockReturnValue of the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
        await processExecuteCalls(electron);
        await mock.mockReturnValue('mock return value');
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('mock return value');
      });
    });

    describe('mockReturnValueOnce', () => {
      it('should set mockReturnValueOnce of the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
        await processExecuteCalls(electron);
        await mock.mockReturnValue('default mock return value');
        await mock.mockReturnValueOnce('first mock return value');
        await mock.mockReturnValueOnce('second mock return value');
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('first mock return value');
        expect(electron.app.getName()).toBe('second mock return value');
        expect(electron.app.getName()).toBe('default mock return value');
      });
    });

    describe('mockResolvedValue', () => {
      it('should set mockResolvedValue of the inner mock', async () => {
        const mock = await createMock('app', 'getFileIcon');
        const electron = {
          app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.mockResolvedValue('mock resolved value');
        await processExecuteCalls(electron);

        expect(await electron.app.getFileIcon('/path/to/icon')).toBe('mock resolved value');
      });
    });

    describe('mockResolvedValueOnce', () => {
      it('should set mockResolvedValueOnce of the inner mock', async () => {
        const mock = await createMock('app', 'getFileIcon');
        const electron = {
          app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.mockResolvedValue('default mock resolved value');
        await mock.mockResolvedValueOnce('first mock resolved value');
        await mock.mockResolvedValueOnce('second mock resolved value');
        await processExecuteCalls(electron);

        expect(await electron.app.getFileIcon('/path/to/icon')).toBe('first mock resolved value');
        expect(await electron.app.getFileIcon('/path/to/icon')).toBe('second mock resolved value');
        expect(await electron.app.getFileIcon('/path/to/icon')).toBe('default mock resolved value');
      });
    });

    describe('mockRejectedValue', () => {
      it('should set mockRejectedValue of the inner mock', async () => {
        const mock = await createMock('app', 'getFileIcon');
        const electron = {
          app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.mockRejectedValue('mock rejected value');
        await processExecuteCalls(electron);

        await expect(() => electron.app.getFileIcon('/path/to/icon')).rejects.toThrow('mock rejected value');
      });
    });

    describe('mockRejectedValueOnce', () => {
      it('should set mockRejectedValueOnce of the inner mock', async () => {
        const mock = await createMock('app', 'getFileIcon');
        const electron = {
          app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.mockRejectedValue('default mock rejected value');
        await mock.mockRejectedValueOnce('first mock rejected value');
        await mock.mockRejectedValueOnce('second mock rejected value');
        await processExecuteCalls(electron);

        await expect(async () => await electron.app.getFileIcon('/path/to/icon')).rejects.toThrow(
          'first mock rejected value',
        );
        await expect(async () => await electron.app.getFileIcon('/path/to/icon')).rejects.toThrow(
          'second mock rejected value',
        );
        await expect(async () => await electron.app.getFileIcon('/path/to/icon')).rejects.toThrow(
          'default mock rejected value',
        );
      });
    });

    describe('mockClear', () => {
      it('should clear the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);

        electron.app.getName();
        electron.app.getName();
        electron.app.getName();

        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[], [], []]);

        await mock.mockClear();
        await processExecuteCalls(electron);

        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([]);
      });
    });

    describe('mockReset', () => {
      it('should reset the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.mockImplementation(() => 'mocked name');
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('mocked name');
        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);

        await mock.mockReset();
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBeUndefined();
        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);
      });
    });

    describe('mockRestore', () => {
      it('should restore the inner mock', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        globalThis.originalApi = {
          app: { getName: () => 'actual name' },
        } as ElectronType;
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBeUndefined();
        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);

        await mock.mockRestore();
        await processExecuteCalls(electron);

        expect(electron.app.getName()).toBe('actual name');
        expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);
      });
    });

    describe('mockReturnThis', () => {
      it('should allow chaining', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name', getVersion: () => 'actual version' } as unknown as Omit<
            ElectronType['app'],
            'on'
          >,
        };
        await processExecuteCalls(electron);
        await mock.mockReturnThis();
        await processExecuteCalls(electron);

        expect((electron.app.getName() as unknown as Omit<ElectronType['app'], 'on'>).getVersion()).toBe(
          'actual version',
        );
      });
    });

    describe('withImplementation', () => {
      it('should temporarily override mock implementation with sync callback', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.withImplementation(
          () => 'temporary name',
          (electron) => electron.app.getName(),
        );
        const executeResults = await processExecuteCalls(electron);

        expect(executeResults).toStrictEqual(['temporary name']);
      });

      it('should temporarily override mock implementation with async callback', async () => {
        const mock = await createMock('app', 'getName');
        const electron = {
          app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
        };
        await processExecuteCalls(electron);
        await mock.withImplementation(
          () => 'temporary name',
          async (electron) => electron.app.getName(),
        );
        const executeResults = await processExecuteCalls(electron);

        expect(executeResults).toStrictEqual(['temporary name']);
      });
    });
  });
});
