import type { ElectronMock } from '@wdio/electron-types';

console.log('===mockStore.ts==> is executed');
export class ElectronServiceMockStore {
  #mockFns: Map<string, ElectronMock>;

  constructor() {
    console.log('===ElectronServiceMockStore constructor==>');
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
    console.log('===ElectronServiceMockStore getMocks==>', this.#mockFns.entries());
    return Array.from(this.#mockFns.entries());
  }
}

const mockStore = new ElectronServiceMockStore();

export default mockStore;
