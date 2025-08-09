import type { ElectronMock } from '@wdio/electron-types';
import { createMock } from '../mock.js';
import mockStore from '../mockStore.js';

export async function mock(apiName: string, funcName: string): Promise<ElectronMock> {
  console.log(`[MOCK-DEBUG] mock command called for ${apiName}.${funcName}`);
  try {
    // retrieve an existing mock from the store
    const existingMock = mockStore.getMock(`electron.${apiName}.${funcName}`);
    await existingMock.mockReset();
    return existingMock;
  } catch (_e) {
    // mock doesn't exist, create a new one and store it
    console.log(`[MOCK-DEBUG] Creating new mock for ${apiName}.${funcName}`);
    const newMock = await createMock(apiName, funcName);
    mockStore.setMock(newMock);
    return newMock;
  }
}
