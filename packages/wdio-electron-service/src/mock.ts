import { type Mock, fn as vitestFn } from '@vitest/spy';
import type {
  AbstractFn,
  ElectronApiFn,
  ElectronInterface,
  ElectronMock,
  ElectronType,
  ExecuteOpts,
} from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('mock');

async function restoreElectronFunctionality(apiName: string, funcName: string) {
  await browser.electron.execute<void, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];
      const originalApi = globalThis.originalApi as Record<ElectronInterface, ElectronType[ElectronInterface]>;
      const originalApiMethod = originalApi[apiName as keyof typeof originalApi][
        funcName as keyof ElectronType[ElectronInterface]
      ] as ElectronApiFn;

      (electronApi[funcName as keyof typeof electronApi] as Mock).mockImplementation(originalApiMethod);
    },
    apiName,
    funcName,
    { internal: true },
  );
}

export async function createMock(apiName: string, funcName: string) {
  log.debug(`[${apiName}.${funcName}] createMock called - starting mock creation`);
  console.log(`[MOCK-DEBUG] createMock called for ${apiName}.${funcName}`);
  const outerMock = vitestFn();
  const outerMockImplementation = outerMock.mockImplementation;
  const outerMockImplementationOnce = outerMock.mockImplementationOnce;
  const outerMockClear = outerMock.mockClear;
  const outerMockReset = outerMock.mockReset;

  outerMock.mockName(`electron.${apiName}.${funcName}`);

  const mock = outerMock as unknown as ElectronMock;

  mock.__isElectronMock = true;

  // Auto-update when mock properties are accessed
  const originalMock = outerMock.mock;
  let needsUpdate = true;
  let updatePromise: Promise<void> | null = null;

  // Properties that should trigger auto-update when accessed
  const autoUpdateProperties = new Set(['calls', 'results', 'lastCall', 'invocationCallOrder']);

  log.debug(`[${apiName}.${funcName}] Installing proxy for mock.mock property`);

  // Create a proper Proxy for the mock object that auto-updates on property access
  const mockProxy = new Proxy(originalMock, {
    get(target, prop, receiver) {
      log.debug(`[${apiName}.${funcName}] Proxy intercepted access to property: ${String(prop)}`);
      console.log(`[MOCK-DEBUG] Proxy intercepted access to property: ${String(prop)} for ${apiName}.${funcName}`);

      // Check if this property should trigger an auto-update
      if (autoUpdateProperties.has(prop as string) && needsUpdate && !updatePromise) {
        log.debug(`[${apiName}.${funcName}] Triggering auto-update on property access: ${String(prop)}`);
        needsUpdate = false; // Prevent multiple rapid updates
        updatePromise = mock
          .update()
          .then(() => {
            log.debug(`[${apiName}.${funcName}] Auto-update completed successfully`);
            updatePromise = null;
          })
          .catch((error) => {
            log.debug(`[${apiName}.${funcName}] Auto-update failed:`, error);
            // Reset flag on error so update can be retried
            needsUpdate = true;
            updatePromise = null;
          });
      } else if (autoUpdateProperties.has(prop as string)) {
        if (!needsUpdate) {
          log.debug(
            `[${apiName}.${funcName}] Property ${String(prop)} accessed but no update needed (recently updated)`,
          );
        } else if (updatePromise) {
          log.debug(`[${apiName}.${funcName}] Property ${String(prop)} accessed but update already in progress`);
        }
      }

      // Return the actual property value from the target
      const value = Reflect.get(target, prop, receiver);
      if (autoUpdateProperties.has(prop as string)) {
        log.debug(`[${apiName}.${funcName}] Returning property ${String(prop)} with value:`, value);
      }
      return value;
    },
  });

  // Replace the mock property with our proxy
  // Try to replace the mock property, but handle cases where it's not configurable (like in tests)
  try {
    log.debug(`[${apiName}.${funcName}] Installing proxy for mock.mock property`);
    // Type assertion needed since TypeScript doesn't know the mock property is deletable at runtime
    delete (mock as unknown as Record<string, unknown>).mock;
    Object.defineProperty(mock, 'mock', {
      get: () => {
        log.debug(`[${apiName}.${funcName}] mock.mock property getter called, returning proxy`);
        return mockProxy;
      },
      enumerable: true,
      configurable: true,
    });
    log.debug(`[${apiName}.${funcName}] Proxy successfully installed`);
  } catch (error) {
    log.debug(`[${apiName}.${funcName}] Failed to replace mock property:`, error);
  }

  // initialise inner (Electron) mock
  await browser.electron.execute<void, [string, string, ExecuteOpts]>(
    async (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];
      const spy = await import('@vitest/spy');
      const mockFn = spy.fn();

      // replace target API with mock
      electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
    },
    apiName,
    funcName,
    { internal: true },
  );

  mock.update = async () => {
    log.debug(`[${apiName}.${funcName}] Starting mock update`);
    // synchronises inner and outer mocks
    const calls = await browser.electron.execute<unknown[][], [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        const mockObj = electron[apiName as keyof typeof electron][
          funcName as keyof ElectronType[ElectronInterface]
        ] as ElectronMock;
        return mockObj.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock?.calls)) : [];
      },
      apiName,
      funcName,
      { internal: true },
    );

    log.debug(
      `[${apiName}.${funcName}] Retrieved ${calls.length} calls from inner mock, outer mock has ${originalMock.calls.length} calls`,
    );

    // re-apply calls from the electron main process mock to the outer one
    if (originalMock.calls.length < calls.length) {
      log.debug(
        `[${apiName}.${funcName}] Applying ${calls.length - originalMock.calls.length} new calls to outer mock`,
      );
      calls.forEach((call: unknown[], index: number) => {
        if (!originalMock.calls[index]) {
          log.debug(`[${apiName}.${funcName}] Applying call ${index}:`, call);
          mock?.apply(mock, call);
        }
      });
    } else {
      log.debug(`[${apiName}.${funcName}] No new calls to synchronize`);
    }

    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    await browser.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, apiName, funcName, mockImplementationStr) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const mockImpl = new Function(`return ${mockImplementationStr}`)() as AbstractFn;
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockImplementation(mockImpl);
      },
      apiName,
      funcName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementation(implFn);

    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await browser.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, apiName, funcName, mockImplementationStr) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const mockImpl = new Function(`return ${mockImplementationStr}`)() as AbstractFn;
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockImplementationOnce(mockImpl);
      },
      apiName,
      funcName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementationOnce(implFn);

    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockReturnValue(returnValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockReturnValueOnce(returnValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, resolvedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockResolvedValue(resolvedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, resolvedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockResolvedValueOnce(resolvedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, rejectedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockRejectedValue(rejectedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await browser.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, rejectedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockRejectedValueOnce(rejectedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockClear = async () => {
    // clears mock history
    await browser.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockClear();
      },
      apiName,
      funcName,
      { internal: true },
    );
    outerMockClear();

    return mock;
  };

  mock.mockReset = async () => {
    // resets inner implementation to an empty function and clears mock history
    await browser.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockReset();
      },
      apiName,
      funcName,
      { internal: true },
    );
    outerMockReset();

    // vitest mockReset doesn't clear mock history so we need to explicitly clear both mocks
    await mock.mockClear();

    return mock;
  };

  mock.mockRestore = async () => {
    // restores inner mock implementation to the original function
    await restoreElectronFunctionality(apiName, funcName);

    // clear mocks
    outerMockClear();
    await mock.mockClear();

    return mock;
  };

  mock.mockReturnThis = async () => {
    return await browser.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockReturnThis();
      },
      apiName,
      funcName,
      { internal: true },
    );
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await browser.electron.execute<unknown, [string, string, string, string, ExecuteOpts]>(
      async (electron, apiName, funcName, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)() as AbstractFn;
        const impl = new Function(`return ${implFnStr}`)() as AbstractFn;
        let result: unknown | Promise<unknown>;
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).withImplementation(impl, () => {
          result = callback(electron);
        });

        return (result as Promise<unknown>)?.then ? await result : result;
      },
      apiName,
      funcName,
      implFn.toString(),
      callbackFn.toString(),
      { internal: true },
    );
  };

  // Internal method to mark mock as needing update - used by service hooks
  mock.__markForUpdate = () => {
    log.debug(`[${apiName}.${funcName}] __markForUpdate called - marking mock as needing update`);
    needsUpdate = true;
  };

  return mock;
}
