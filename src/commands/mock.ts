import type * as Electron from 'electron';
import { fn, type Mock } from '@vitest/spy';

import log from '../log.js';

type ElectronType = typeof Electron;
type ElectronInterface = keyof ElectronType;

const getKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>;
const mockMap = new Map<string, Mock>();

export async function mock<Interface extends ElectronInterface>(
  apiName: Interface,
  funcName: keyof ElectronType[Interface],
  mockImplementation: (...args: unknown[]) => unknown = () => {},
) {
  const id = `${apiName}.${String(funcName)}`;
  await browser.electron.execute(
    (electron, apiName, funcName) => {
      electron[apiName][funcName] = fn(() => {}) as ElectronType[Interface][keyof ElectronType[Interface]];
    },
    apiName,
    funcName,
  );

  const mock = fn(mockImplementation);
  mockMap.set(id, mock);

  async function mockGetter() {
    log.debug(`getting mock instance for electron.${apiName}.${String(funcName)}...`);
    const mock = mockMap.get(id);
    if (!mock) {
      throw new Error(`No mock registered for "${id}"`);
    }

    const calls = await browser.electron.execute(
      (electron, apiName, funcName) => (electron[apiName][funcName] as Mock).mock.calls,
      apiName,
      funcName,
    );

    if (!calls) {
      throw new Error(`mock for electron.${apiName}.${String(funcName)}() not found!`);
    }

    /**
     * create a fake mock to reapply calls on it
     */
    for (const call of calls) {
      mock(...call);
    }

    return mock;
  }

  patchMock(browser, mock, mockGetter, apiName, funcName);
  return mockGetter;
}

function patchMock<Interface extends ElectronInterface>(
  browser: WebdriverIO.Browser,
  mock: Mock,
  mockGetter: any,
  apiName: Interface,
  funcName: keyof ElectronType[Interface],
) {
  log.debug(`patch mock instance for electron.${apiName}.${String(funcName)}(...)`);
  for (const fnName of getKeys(mock)) {
    mockGetter[fnName] = (...args: unknown[]) =>
      browser.electron.execute(
        (electron, apiName, funcName, fnName, args) => {
          if (typeof (electron[apiName][funcName] as Mock)[fnName] !== 'function') {
            throw new Error(`mock for electron.${apiName}.${String(funcName)}() not found!`);
          }

          (electron[apiName][funcName] as any)[fnName](...args);
        },
        apiName,
        funcName,
        fnName,
        args,
      );
  }
}
