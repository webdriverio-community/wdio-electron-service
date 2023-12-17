import { fn as vitestFn, MockContext, type Mock } from '@vitest/spy';
import type { ElectronInterface, ElectronType } from './types.js';
import log from './log.js';

type BasicFn = (...args: unknown[]) => unknown;
type BasicAsyncFn = (...args: unknown[]) => Promise<unknown>;
type AbstractFn = BasicFn | BasicAsyncFn;
type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];
type MockedElectronFn = {
  revert: () => void;
};

type Omitted =
  | 'mockImplementation'
  | 'mockImplementationOnce'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce'
  | 'withImplementation';

interface AsyncMock extends Omit<Mock, Omitted> {
  mockName(name: string): any;
  mockClear(): any;
  mockReset(): any;
  mockReturnThis(): any;
  mockImplementation(fn: AbstractFn): Promise<any>;
  mockImplementationOnce(fn: AbstractFn): Promise<any>;
  mockReturnValue(obj: unknown): Promise<any>;
  mockReturnValueOnce(obj: unknown): Promise<any>;
  mockResolvedValue(obj: unknown): Promise<any>;
  mockResolvedValueOnce(obj: unknown): Promise<any>;
  mockRejectedValue(obj: unknown): Promise<any>;
  mockRejectedValueOnce(obj: unknown): Promise<any>;
}

export class ElectronServiceMock implements AsyncMock {
  #apiName: string;
  #funcName: string;
  #name: string;
  #mockImplementation?: AbstractFn;
  mock: MockContext<unknown, unknown>;

  constructor(apiName: string, funcName: string) {
    this.#apiName = apiName;
    this.#funcName = funcName;
    this.#name = `electron.${this.#apiName}.${this.#funcName}`;
    this.mock = {
      calls: [],
      instances: [],
      invocationCallOrder: [],
      lastCall: undefined,
      results: [],
    };
    this.#mockImplementation = () => undefined;
  }

  getMockName(): string {
    return this.#name;
  }

  mockName(name: string): ElectronServiceMock {
    this.#name = name;
    return this;
  }

  mockClear(): ElectronServiceMock {
    this.mock.calls = [];
    this.mock.instances = [];
    this.mock.invocationCallOrder = [];
    this.mock.lastCall = undefined;
    this.mock.results = [];
    return this;
  }

  async mockReset(): Promise<ElectronServiceMock> {
    this.mockClear();
    await this.#setImplementation(() => undefined);
    // resets all "once" implementations
    return this;
  }

  async mockRestore(): Promise<void> {
    this.mockClear();
    // restores inner implementation to the original function
    await browser.electron.execute(
      (electron, apiName, funcName) =>
        (
          electron[apiName as keyof typeof electron][
            funcName as keyof ElectronType[ElectronInterface]
          ] as MockedElectronFn
        ).revert(),
      this.#apiName,
      this.#funcName,
    );
    // resets all "once" implementations
  }

  async update() {
    const calls = await browser.electron.execute(
      (electron, apiName, funcName) =>
        (electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock).mock
          .calls,
      this.#apiName,
      this.#funcName,
    );

    // re-apply calls from the electron main process mock to the outer one
    if (this.mock.calls.length < calls.length) {
      log.debug('setting calls', calls);
      calls.forEach((call: unknown[], index: number) => {
        if (!this.mock.calls[index]) {
          this.#mockImplementation?.apply(this, call);
        }
      });
    }
    log.debug('calls set', this.mock.calls);

    return this;
  }

  async #setImplementation(mockImplementation: AbstractFn = () => undefined, mockReturnValue?: unknown): Promise<void> {
    await browser.electron.execute(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        let originalApi = window.wdioElectron.originalApi;
        if (!window.wdioElectron.originalApi) {
          originalApi = Object.assign({}, electronApi) as unknown as Record<
            ElectronInterface,
            ElectronType[ElectronInterface]
          >;
        }

        const mockFn = vitestFn<[], unknown>(() => {});
        mockFn.mockReturnValue(returnValue);

        electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
        (electronApi[funcName as keyof typeof electronApi] as MockedElectronFn).revert = () => {
          electronApi[funcName as keyof typeof electronApi] = (
            originalApi as Record<ElectronInterface, ElectronType[ElectronInterface]>
          )[funcName as keyof typeof originalApi] as ElectronApiFn;
        };
      },
      this.#apiName,
      this.#funcName,
      mockReturnValue,
    );
    this.#mockImplementation = mockImplementation;
  }

  async mockImplementation(fn: AbstractFn): Promise<ElectronServiceMock> {
    await this.#setImplementation(fn);
    return this;
  }

  async mockImplementationOnce(fn: AbstractFn): Promise<ElectronServiceMock> {
    await this.#setImplementation((...args: unknown[]) => {
      this.mockReset();
      return fn.apply(fn, args);
    });
    return this;
  }

  async mockReturnValue(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(undefined, obj);
    return this;
  }

  async mockReturnValueOnce(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(() => this.mockReset(), obj);
    return this;
  }

  getMockImplementation(): AbstractFn | undefined {
    return this.#mockImplementation;
  }

  mockReturnThis(): ElectronServiceMock {
    return this;
  }

  async mockResolvedValue(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(undefined, Promise.resolve(obj));
    return this;
  }

  async mockResolvedValueOnce(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(() => this.mockReset(), Promise.resolve(obj));
    return this;
  }

  async mockRejectedValue(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(undefined, Promise.reject(obj));
    return this;
  }

  async mockRejectedValueOnce(obj: unknown): Promise<ElectronServiceMock> {
    await this.#setImplementation(() => this.mockReset(), Promise.reject(obj));
    return this;
  }
}
