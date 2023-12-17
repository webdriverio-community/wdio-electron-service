import { ElectronServiceMock } from '../mock.js';
import { mock } from './mock.js';
import type { ElectronInterface } from '../types.js';

export async function mockAll(apiName: string) {
  const apiFnNames = await browser.electron.execute(
    (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
    apiName,
  );
  const mockedApis: Record<string, ElectronServiceMock> = apiFnNames
    .split(',')
    .reduce((a, funcName) => ({ ...a, [funcName]: 'placeholder' }), {});

  for (const funcName in mockedApis) {
    await mock(apiName as ElectronInterface, funcName);
  }
}
