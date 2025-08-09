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

async function restoreElectronFunctionality(apiName: string, funcName: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];
      const originalApi = globalThis.originalApi as Record<ElectronInterface, ElectronType[ElectronInterface]>;
      const originalApiMethod = originalApi[apiName as keyof typeof originalApi][
        funcName as keyof ElectronType[ElectronInterface]
      ] as ElectronApiFn;

      const target = electronApi[funcName as keyof typeof electronApi] as unknown;
      if (target && typeof (target as { mockImplementation?: unknown }).mockImplementation === 'function') {
        (target as Mock).mockImplementation(originalApiMethod);
      } else {
        // Fallback: directly restore the original function using Reflect to avoid index signature issues
        Reflect.set(electronApi as unknown as object, funcName, originalApiMethod as unknown as ElectronApiFn);
      }
    },
    apiName,
    funcName,
    { internal: true },
  );
}

export async function createMock(apiName: string, funcName: string, browserContext?: WebdriverIO.Browser) {
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

  // Store the original mock property for later auto-update setup
  const originalMock = outerMock.mock;

  // Auto-update state management
  let needsUpdate = true;
  let updatePromise: Promise<void> | null = null;

  // Function to trigger auto-update
  const triggerAutoUpdate = (prop: string | symbol, reason: string) => {
    if (needsUpdate && !updatePromise) {
      log.debug(`[${apiName}.${funcName}] Triggering auto-update on ${reason}: ${String(prop)}`);
      needsUpdate = false; // Prevent multiple rapid updates

      // Start update but don't await it in getter - this would block synchronous property access
      updatePromise = (async () => {
        try {
          log.debug(`[${apiName}.${funcName}] Starting async update for ${reason}: ${String(prop)}`);
          await mock.update();
          log.debug(`[${apiName}.${funcName}] Auto-update completed successfully for ${reason}: ${String(prop)}`);
        } catch (error) {
          log.debug(`[${apiName}.${funcName}] Auto-update failed for ${reason}: ${String(prop)}`, error);
          // Reset flag on error so update can be retried
          needsUpdate = true;
        } finally {
          updatePromise = null;
        }
      })();
    } else if (!needsUpdate) {
      log.debug(`[${apiName}.${funcName}] ${reason} ${String(prop)} accessed but no update needed (recently updated)`);
    } else if (updatePromise) {
      log.debug(`[${apiName}.${funcName}] ${reason} ${String(prop)} accessed but update already in progress`);
    }
  };

  // APPROACH: Wrapper Object Strategy
  // Since we can't modify the Vitest mock's 'mock' property (it's non-configurable),
  // we'll create a wrapper object that provides auto-updating functionality

  log.debug(`[${apiName}.${funcName}] Creating auto-updating mock wrapper object`);

  // Create an auto-updating mock data object
  const autoUpdatingMockData = {
    get calls() {
      log.debug(`[${apiName}.${funcName}] mockWrapper.mock.calls getter accessed - triggering auto-update`);
      triggerAutoUpdate('calls', 'mockWrapper.mock.calls getter access');
      return originalMock.calls;
    },
    get results() {
      log.debug(`[${apiName}.${funcName}] mockWrapper.mock.results getter accessed - triggering auto-update`);
      triggerAutoUpdate('results', 'mockWrapper.mock.results getter access');
      return originalMock.results;
    },
    get lastCall() {
      log.debug(`[${apiName}.${funcName}] mockWrapper.mock.lastCall getter accessed - triggering auto-update`);
      triggerAutoUpdate('lastCall', 'mockWrapper.mock.lastCall getter access');
      return originalMock.lastCall;
    },
    get invocationCallOrder() {
      log.debug(
        `[${apiName}.${funcName}] mockWrapper.mock.invocationCallOrder getter accessed - triggering auto-update`,
      );
      triggerAutoUpdate('invocationCallOrder', 'mockWrapper.mock.invocationCallOrder getter access');
      return originalMock.invocationCallOrder;
    },
    // Forward other properties directly from original mock
    get contexts() {
      return originalMock.contexts;
    },
    get instances() {
      return originalMock.instances;
    },
    get settledResults() {
      return originalMock.settledResults;
    },
  };

  // Create a wrapper function that delegates to the original mock function
  // but also provides auto-updating mock data
  const wrapperMock = ((...args: unknown[]) => {
    // Delegate to the original mock function
    return (mock as (...args: unknown[]) => unknown)(...args);
  }) as ElectronMock;

  // Copy all properties and methods from the original mock to the wrapper
  Object.setPrototypeOf(wrapperMock, Object.getPrototypeOf(mock));
  Object.getOwnPropertyNames(mock).forEach((key) => {
    if (key !== 'mock' && key !== 'length' && key !== 'name') {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(mock, key);
        if (descriptor) {
          Object.defineProperty(wrapperMock, key, descriptor);
        }
      } catch (_error) {
        // Skip properties that can't be copied
      }
    }
  });

  // Override the mock property with our auto-updating version
  Object.defineProperty(wrapperMock, 'mock', {
    get: () => autoUpdatingMockData,
    enumerable: true,
    configurable: true,
  });

  // Use provided browser context or fallback to global browser
  const browserToUse = browserContext || browser;

  log.debug(`[${apiName}.${funcName}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  // initialise inner (Electron) mock
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
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
    const calls = await browserToUse.electron.execute<unknown[][], [string, string, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
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
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
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
    await restoreElectronFunctionality(apiName, funcName, browserToUse);

    // clear mocks
    outerMockClear();
    await mock.mockClear();

    return mock;
  };

  mock.mockReturnThis = async () => {
    return await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
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
    return await browserToUse.electron.execute<unknown, [string, string, string, string, ExecuteOpts]>(
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

  // Ensure all mock methods are properly bound to the wrapper
  wrapperMock.mockImplementation = mock.mockImplementation.bind(mock);
  wrapperMock.mockImplementationOnce = mock.mockImplementationOnce.bind(mock);
  wrapperMock.mockReturnValue = mock.mockReturnValue.bind(mock);
  wrapperMock.mockReturnValueOnce = mock.mockReturnValueOnce.bind(mock);
  wrapperMock.mockResolvedValue = mock.mockResolvedValue.bind(mock);
  wrapperMock.mockResolvedValueOnce = mock.mockResolvedValueOnce.bind(mock);
  wrapperMock.mockRejectedValue = mock.mockRejectedValue.bind(mock);
  wrapperMock.mockRejectedValueOnce = mock.mockRejectedValueOnce.bind(mock);
  wrapperMock.mockClear = mock.mockClear.bind(mock);
  wrapperMock.mockReset = mock.mockReset.bind(mock);
  wrapperMock.mockRestore = mock.mockRestore.bind(mock);
  wrapperMock.mockReturnThis = mock.mockReturnThis.bind(mock);
  wrapperMock.withImplementation = mock.withImplementation.bind(mock);
  wrapperMock.update = mock.update.bind(mock);

  // Set additional properties
  wrapperMock.__isElectronMock = true;

  // Internal method to mark mock as needing update - used by service hooks
  wrapperMock.__markForUpdate = () => {
    log.debug(`[${apiName}.${funcName}] __markForUpdate called - marking mock as needing update`);
    needsUpdate = true;
  };

  log.debug(`[${apiName}.${funcName}] Auto-updating mock wrapper created successfully`);

  // Return the wrapper instead of the original mock
  return wrapperMock;
}
