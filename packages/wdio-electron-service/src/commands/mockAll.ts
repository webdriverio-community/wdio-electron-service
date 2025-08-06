import type { ElectronMock, ExecuteOpts } from '@wdio/electron-types';
import { mock } from './mock.js';

export async function mockAll(apiName: string) {
  const apiFnNames = await browser.electron.execute<string, [string, ExecuteOpts]>(
    (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
    apiName,
    { internal: true },
  );
  const mockedApis: Record<string, ElectronMock> = {};
  const funcNames = apiFnNames.split(',');
  for (const funcName of funcNames) {
    mockedApis[funcName] = () => undefined;
  }

  for (const funcName in mockedApis) {
    mockedApis[funcName] = await mock(apiName, funcName);
  }

  return mockedApis;
}
