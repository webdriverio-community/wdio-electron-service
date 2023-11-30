import { ElectronServiceMock } from './mock.js';
import type { ElectronInterface } from 'src/types.js';

export async function mockAll(apiName: string) {
  const electronServiceMock = new ElectronServiceMock(apiName as ElectronInterface);

  browser.electron._mocks[apiName] = electronServiceMock;

  return await electronServiceMock.init();
}
