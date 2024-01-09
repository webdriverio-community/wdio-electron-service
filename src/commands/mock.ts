import { createMock } from '../mock.js';
import mockStore from '../mockStore.js';
import type { ElectronMock } from '../types.js';

export async function mock(apiName: string, funcName: string): Promise<ElectronMock> {
  try {
    // retrieve an existing mock
    const mock = mockStore.getMock(`electron.${apiName}.${funcName}`);
    await mock.mockReset();
    return mock;
  } catch (e) {
    // mock doesn't exist, create a new one
    const mock = await createMock(apiName, funcName);
    return mockStore.setMock(mock);
  }
}
