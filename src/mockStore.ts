import log from './log.js';
import type { ElectronServiceMock } from './mock.js';

export class ElectronServiceMockStore {
  mockFns: Map<string, ElectronServiceMock>;

  constructor() {
    this.mockFns = new Map<string, ElectronServiceMock>();
  }

  setMock(mock: ElectronServiceMock): void {
    this.mockFns.set(mock.getMockName(), mock);
  }

  async getMock(mockId: string) {
    log.debug(`getting mock instance for ${mockId}...`);
    const mock = this.mockFns.get(mockId);
    if (!mock) {
      throw new Error(`No mock registered for "${mockId}"`);
    }

    await mock.update();

    return mock;
  }

  //   async unMock(mockId: string) {
  //     const [_, apiName, funcName] = mockId.split('.');
  //     this.mockFns.delete(mockId);
  //     await browser.electron.execute(
  //       (electron, apiName, funcName) =>
  //         (
  //           electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as MockedFn
  //         ).revert(),
  //       apiName,
  //       funcName,
  //     );
  //   }
}

const mockStore = new ElectronServiceMockStore();

export default mockStore;
