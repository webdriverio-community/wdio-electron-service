import type * as Electron from 'electron';
import { fn, type Mock } from '@vitest/spy';

import log from '../log.js';

type ElectronType = typeof Electron;
type ElectronInterface = keyof ElectronType;
type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];
type MockFn = (...args: unknown[]) => unknown;
type MockedFn = {
  revert: () => void;
};

export class ElectronServiceMock {
  private mockFns: Map<string, MockFn>;
  public apiName: ElectronInterface;

  constructor(apiName: ElectronInterface) {
    this.apiName = apiName;
    this.mockFns = new Map<string, MockFn>();
  }

  public async init(): Promise<{
    getMock: (funcName: string) => Promise<MockFn>;
    setMock: (funcName: string, mockImplementation?: MockFn) => Promise<ElectronServiceMock>;
    unMock: (funcName: string) => Promise<ElectronServiceMock>;
  }> {
    const apiKeyNames = await browser.electron.execute(
      (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
      this.apiName,
    );

    return apiKeyNames.split(',').reduce(
      (a, v) => ({
        ...a,
        [v]: {
          mockImplementation: (mockImplementation: MockFn) => this.setMock(v, mockImplementation),
          mockImplementationOnce: (mockImplementation: MockFn) => {
            const existingMock = this.mockFns.get(v);
            if (existingMock) {
              this.setMock(v, () => {
                this.setMock(v, existingMock);
                return mockImplementation();
              });
            } else {
              this.setMock(v, () => {
                this.unMock(v);
                return mockImplementation();
              });
            }
          },
        },
      }),
      { getMock: this.getMock.bind(this), setMock: this.setMock.bind(this), unMock: this.unMock.bind(this) },
    );
  }

  public async setMock(funcName: string, mockImplementation: MockFn = () => {}): Promise<ElectronServiceMock> {
    await browser.electron.execute(
      (electron, apiName, funcName) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const originalApi = Object.assign({}, electronApi);
        electronApi[funcName as keyof typeof electronApi] = fn(() => {}) as ElectronApiFn;
        (electronApi[funcName as keyof typeof electronApi] as MockedFn).revert = () => {
          electronApi[funcName as keyof typeof electronApi] = originalApi[funcName as keyof typeof originalApi];
        };
      },
      this.apiName,
      funcName,
    );
    this.mockFns.set(funcName, fn(mockImplementation) as MockFn);
    return this;
  }

  public async getMock(funcName: string) {
    const mockId = `electron.${this.apiName}.${funcName}`;
    log.debug(`getting mock instance for ${mockId}...`);
    const mock = this.mockFns.get(funcName);
    if (!mock) {
      throw new Error(`No mock registered for "${mockId}"`);
    }

    const calls = await browser.electron.execute(
      (electron, apiName, funcName) =>
        (electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock).mock
          .calls,
      this.apiName,
      funcName,
    );

    if (!calls) {
      throw new Error(`No mock for ${mockId}() was found!`);
    }

    // re-apply calls from the electron main process mock to this one
    for (const call of calls) {
      mock.apply(mock, call);
    }

    return mock;
  }

  public async unMock(funcName?: string) {
    // when funcName is unspecified we unmock all of the mocked functions
    if (!funcName) {
      for (const [mockFnName] of this.mockFns) {
        await this.unMock(mockFnName);
      }
      return this;
    }

    this.mockFns.delete(funcName as string);
    await browser.electron.execute(
      (electron, apiName, funcName) =>
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as MockedFn
        ).revert(),
      this.apiName,
      funcName,
    );

    return this;
  }
}

export async function mock(apiName: string) {
  const electronServiceMock = new ElectronServiceMock(apiName as ElectronInterface);

  browser.electron._mocks[apiName] = electronServiceMock;

  return await electronServiceMock.init();
}
