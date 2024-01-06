import type { AsyncMock } from './mock.js';

export class ElectronServiceMockStore {
  #mockFns: Map<string, AsyncMock>;

  constructor() {
    this.#mockFns = new Map<string, AsyncMock>();
  }

  setMock(mock: AsyncMock): AsyncMock {
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

  removeMock(mockId: string) {
    this.#mockFns.delete(mockId);
  }
}

const mockStore = new ElectronServiceMockStore();

export default mockStore;
