import type { ElectronMock } from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';
import { createMock } from '../mock.js';
import mockStore from '../mockStore.js';

const log = createLogger('mock');

export async function mock(apiName: string, funcName: string): Promise<ElectronMock> {
  log.debug(`[${apiName}.${funcName}] mock command called`);
  try {
    // retrieve an existing mock from the store
    const existingMock = mockStore.getMock(`electron.${apiName}.${funcName}`);
    log.debug(`[${apiName}.${funcName}] Found existing mock, resetting`);
    await existingMock.mockReset();
    return existingMock;
  } catch (_e) {
    // mock doesn't exist, create a new one and store it
    log.debug(`[${apiName}.${funcName}] Creating new mock`);
    const newMock = await createMock(apiName, funcName);
    mockStore.setMock(newMock);
    return newMock;
  }
}
