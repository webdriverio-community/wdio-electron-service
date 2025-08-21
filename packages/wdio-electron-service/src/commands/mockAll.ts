import { mock } from './mock.js';
import type { ElectronMock, ExecuteOpts } from '@wdio/electron-types';

interface ElectronServiceContext {
  browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
}

export async function mockAll(this: ElectronServiceContext, apiName: string) {
  const apiFnNames = await browser.electron.execute<string, [string, ExecuteOpts]>(
    (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
    apiName,
    { internal: true },
  );
  const mockedApis: Record<string, ElectronMock> = apiFnNames
    .split(',')
    .reduce((a, funcName) => ({ ...a, [funcName]: () => undefined }), {});

  for (const funcName in mockedApis) {
    mockedApis[funcName] = await mock.call(this, apiName, funcName);
  }

  return mockedApis;
}
