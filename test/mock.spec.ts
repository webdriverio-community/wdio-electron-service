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

async function processAsyncExecuteCalls(electron: ElectronObj) {
  const executeCalls = (globalThis.browser.electron.execute as Mock).mock.calls as ExecuteCalls;

  return Promise.all(
    executeCalls.map(([executeFn, apiName, funcName, ...additionalArgs]) =>
      executeFn(electron, apiName, funcName, ...additionalArgs),
    ),
  );
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
    const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
    processExecuteCalls(electron);

    expect(electron.app.getName).toStrictEqual(expect.anyMockFunction());
  });

  describe('mockImplementation', () => {
    it('should set mockImplementation of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockImplementation(() => 'mock implementation');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('mock implementation');
    });
  });

  describe('mockImplementationOnce', () => {
    it('should set mockImplementationOnce of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockImplementation(() => 'default mock implementation');
      await mock.mockImplementationOnce(() => 'first mock implementation');
      await mock.mockImplementationOnce(() => 'second mock implementation');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('first mock implementation');
      expect(electron.app.getName()).toBe('second mock implementation');
      expect(electron.app.getName()).toBe('default mock implementation');
    });
  });

  describe('mockReturnValue', () => {
    it('should set mockReturnValue of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockReturnValue('mock return value');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('mock return value');
    });
  });

  describe('mockReturnValueOnce', () => {
    it('should set mockReturnValueOnce of the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = { app: { getName: () => 'actual name' } as Omit<ElectronType['app'], 'on'> };
      await mock.mockReturnValue('default mock return value');
      await mock.mockReturnValueOnce('first mock return value');
      await mock.mockReturnValueOnce('second mock return value');
      processExecuteCalls(electron);

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
      await mock.mockResolvedValue('mock resolved value');
      processExecuteCalls(electron);

      expect(await electron.app.getFileIcon('/path/to/icon')).toBe('mock resolved value');
    });
  });

  describe('mockResolvedValueOnce', () => {
    it('should set mockResolvedValueOnce of the inner mock', async () => {
      const mock = await createMock('app', 'getFileIcon');
      const electron = {
        app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
      };
      await mock.mockResolvedValue('default mock resolved value');
      await mock.mockResolvedValueOnce('first mock resolved value');
      await mock.mockResolvedValueOnce('second mock resolved value');
      processExecuteCalls(electron);

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
      await mock.mockRejectedValue('mock rejected value');
      processExecuteCalls(electron);

      await expect(async () => await electron.app.getFileIcon('/path/to/icon')).rejects.toThrow('mock rejected value');
    });
  });

  describe('mockRejectedValueOnce', () => {
    it('should set mockRejectedValueOnce of the inner mock', async () => {
      const mock = await createMock('app', 'getFileIcon');
      const electron = {
        app: { getFileIcon: () => Promise.resolve('actual fileIcon') } as unknown as Omit<ElectronType['app'], 'on'>,
      };
      await mock.mockRejectedValue('default mock rejected value');
      await mock.mockRejectedValueOnce('first mock rejected value');
      await mock.mockRejectedValueOnce('second mock rejected value');
      processExecuteCalls(electron);

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
      processExecuteCalls(electron);

      electron.app.getName();
      electron.app.getName();
      electron.app.getName();

      expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[], [], []]);

      await mock.mockClear();
      processExecuteCalls(electron);

      expect((electron.app.getName as Mock).mock.calls).toStrictEqual([]);
    });
  });

  describe('mockReset', () => {
    it('should reset the inner mock', async () => {
      const mock = await createMock('app', 'getName');
      const electron = {
        app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
      };
      await mock.mockImplementation(() => 'mocked name');
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBe('mocked name');
      expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);

      await mock.mockReset();
      processExecuteCalls(electron);

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
        app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
      };
      processExecuteCalls(electron);

      expect(electron.app.getName()).toBeUndefined();
      expect((electron.app.getName as Mock).mock.calls).toStrictEqual([[]]);

      await mock.mockRestore();
      processExecuteCalls(electron);

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

      await mock.mockReturnThis();
      processExecuteCalls(electron);

      expect((electron.app.getName() as unknown as Omit<ElectronType['app'], 'on'>).getVersion()).toBe(
        'actual version',
      );
    });
  });

  describe('withImplementation', () => {
    it('should temporarily override mock implementation', async () => {
      const mock = await createMock('app', 'getName');
      const electron = {
        app: { getName: () => 'actual name' } as unknown as Omit<ElectronType['app'], 'on'>,
      };
      await mock.withImplementation(
        () => 'temporary name',
        (electron) => electron.app.getName(),
      );
      const executeResults = await processAsyncExecuteCalls(electron);

      // first result is that of the mock initialisation call
      expect(executeResults).toStrictEqual([undefined, 'temporary name']);
    });
  });

  // TODO: update
});
