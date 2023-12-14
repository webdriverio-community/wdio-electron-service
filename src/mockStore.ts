import { fn, type Mock } from '@vitest/spy';

import log from './log.js';
import type { ElectronInterface, ElectronType } from './types.js';

type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];
type MockFn = (...args: unknown[]) => unknown;
type MockedFn = {
  revert: () => void;
};

export class ElectronServiceMockStore {
  mockFns: Map<string, Mock>;

  constructor() {
    this.mockFns = new Map<string, Mock>();
  }

  async setMock(mockId: string, mockImplementation: MockFn = () => {}, mockReturnValue?: unknown): Promise<MockFn> {
    const [_, apiName, funcName] = mockId.split('.');
    if (this.mockFns.has(mockId)) {
      await this.unMock(mockId);
    }
    await browser.electron.execute(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const originalApi = Object.assign({}, electronApi);
        const mockFn = fn<[], unknown>(() => {});

        mockFn.mockReturnValue(returnValue);
        electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
        (electronApi[funcName as keyof typeof electronApi] as MockedFn).revert = () => {
          electronApi[funcName as keyof typeof electronApi] = originalApi[funcName as keyof typeof originalApi];
        };
      },
      apiName,
      funcName,
      mockReturnValue,
    );
    const mockFn = fn(mockImplementation) as Mock;
    this.mockFns.set(mockId, mockFn);

    return mockFn;
  }

  async getMock(mockId: string) {
    const [_, apiName, funcName] = mockId.split('.');
    log.debug(`getting mock instance for ${mockId}...`);
    if (!funcName) {
      throw new Error(`No mock registered for "${mockId}"`);
    }
    const mock = this.mockFns.get(mockId);
    if (!mock) {
      throw new Error(`No mock registered for "${mockId}"`);
    }

    const calls = await browser.electron.execute(
      (electron, apiName, funcName) =>
        (electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock).mock
          .calls,
      apiName,
      funcName,
    );

    if (!calls) {
      throw new Error(`No mock for ${mockId}() was found!`);
    }

    // re-apply calls from the electron main process mock to this one
    if (mock.mock.calls.length < calls.length) {
      log.debug('setting calls', calls);
      calls.forEach((call: unknown, index: number) => {
        if (!mock.mock.calls[index]) {
          mock.apply(mock, call);
        }
      });
    }
    log.debug('calls set', mock.mock.calls);

    return mock;
  }

  async unMock(mockId: string) {
    const [_, apiName, funcName] = mockId.split('.');
    this.mockFns.delete(mockId);
    await browser.electron.execute(
      (electron, apiName, funcName) =>
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as MockedFn
        ).revert(),
      apiName,
      funcName,
    );
  }
}

const mockStore = new ElectronServiceMockStore();

export default mockStore;
