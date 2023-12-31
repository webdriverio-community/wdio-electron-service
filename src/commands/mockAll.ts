import { AsyncMock } from '../mock.js';
import { mock } from './mock.js';

export async function mockAll(apiName: string) {
  const apiFnNames = await browser.electron.execute(
    (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
    apiName,
  );
  const mockedApis: Record<string, AsyncMock> = apiFnNames
    .split(',')
    .reduce((a, funcName) => ({ ...a, [funcName]: 'placeholder' }), {});

  for (const funcName in mockedApis) {
    mockedApis[funcName] = await mock(apiName, funcName);
  }

  return mockedApis;
}
