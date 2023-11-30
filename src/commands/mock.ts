import { fn, type Mock } from '@vitest/spy';

import log from '../log.js';
import type { ElectronInterface, ElectronType } from 'src/types.js';

type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];
type MockFn = (...args: unknown[]) => unknown;
type WrappedMockFn = {
  mockReturnValue: (returnValue: unknown) => Promise<MockFn>;
  mockImplementation: (implementationFn: () => unknown) => Promise<MockFn>;
  update: () => Promise<MockFn>;
  unMock: () => Promise<void>;
} & MockFn;
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

  public async init(): Promise<Record<string, WrappedMockFn>> {
    const apiFnNames = await browser.electron.execute(
      (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
      this.apiName,
    );

    const mockedApis: Record<string, WrappedMockFn> = apiFnNames
      .split(',')
      .reduce((a, funcName) => ({ ...a, [funcName]: 'placeholder' }), {});

    for (const apiFn in mockedApis) {
      mockedApis[apiFn as keyof typeof mockedApis] = await this.initFn(apiFn);
    }

    return mockedApis;
  }

  public async initFn(funcName: string, mockReturnValue?: unknown): Promise<WrappedMockFn> {
    const mock = (await this.setMock(funcName, undefined, mockReturnValue)) as WrappedMockFn;
    mock.mockReturnValue = async (returnValue: unknown) => {
      await this.unMock(funcName);
      return await this.setMock(funcName, undefined, returnValue);
    };
    mock.mockImplementation = async (implementationFn: () => unknown) => {
      await this.unMock(funcName);
      return await this.setMock(funcName, implementationFn);
    };
    mock.update = this.getMock.bind(this, funcName);
    mock.unMock = this.unMock.bind(this, funcName);

    return mock;
  }

  private async setMock(
    funcName: string,
    mockImplementation: MockFn = () => {},
    mockReturnValue?: unknown,
  ): Promise<MockFn> {
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
      this.apiName,
      funcName,
      mockReturnValue,
    );
    const mockFn = fn(mockImplementation) as MockFn;
    this.mockFns.set(funcName, mockFn);

    return mockFn;
  }

  public async getMock(funcName?: string) {
    const mockId = `electron.${String(this.apiName)}.${funcName}`;
    log.debug(`getting mock instance for ${mockId}...`);
    if (!funcName) {
      throw new Error(`No mock registered for "${mockId}"`);
    }
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
      return;
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
  }
}

export async function mock(apiName: string, funcName: string, mockReturnValue?: unknown) {
  const electronServiceMock = new ElectronServiceMock(apiName as ElectronInterface);

  browser.electron._mocks[apiName] = electronServiceMock;

  return await electronServiceMock.initFn(funcName, mockReturnValue);
}
