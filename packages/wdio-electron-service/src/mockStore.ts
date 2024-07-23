import type { ElectronMock } from '@wdio/electron-types';

export class ElectronServiceMockStore {
  #mockFns: Map<string, ElectronMock>;

  constructor() {
    this.#mockFns = new Map<string, ElectronMock>();
  }

  setMock(mock: ElectronMock): ElectronMock {
    this.#mockFns.set(mock.getMockName(), mock);
    return mock;
  }

  getMock(mockId: string) {
    const mock = this.#mockFns.get(mockId);
    if (!mock) {
      throw new Error(`No mock registered for "${mockId}"`);
    }

    return mock;
  }

  getMocks() {
    return Array.from(this.#mockFns.entries());
  }
}

const mockStore = new ElectronServiceMockStore();

export default mockStore;
