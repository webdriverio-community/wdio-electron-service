import { mock } from './mock.js';
import type { ElectronMock } from '../types.js';

export async function mockAll(apiName: string) {
  const apiFnNames = await browser.electron.execute(
    (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
    apiName,
  );
  const mockedApis: Record<string, ElectronMock> = apiFnNames
    .split(',')
    .reduce((a, funcName) => ({ ...a, [funcName]: () => undefined }), {});

  for (const funcName in mockedApis) {
    mockedApis[funcName] = await mock(apiName, funcName);
  }

  return mockedApis;
}
