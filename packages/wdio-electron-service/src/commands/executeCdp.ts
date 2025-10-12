import * as babelParser from '@babel/parser';
import type { ExecuteOpts } from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('service');

import { parse, print } from 'recast';
import type { ElectronCdpBridge } from '../bridge';

import mockStore from '../mockStore.js';

export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  cdpBridge: ElectronCdpBridge | undefined,
  script: string | ((electron: typeof Electron.CrossProcessExports, ...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue | ReturnValue[] | undefined> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  if (browser.isMultiremote) {
    const mrBrowser = browser as unknown as WebdriverIO.MultiRemoteBrowser;
    return await Promise.all(
      mrBrowser.instances.map(async (instance) => {
        const mrInstance = mrBrowser.getInstance(instance);
        return mrInstance.electron.execute(script, ...args);
      }),
    );
  }

  if (!cdpBridge) {
    throw new Error('CDP Bridge is not yet initialised');
  }

  const functionDeclaration = removeFirstArg(script.toString());
  const argsArray = args.map((arg) => ({ value: arg }));

  // Minimal debug only
  const scriptLength = Buffer.byteLength(functionDeclaration, 'utf-8');
  log.debug('Executing script length:', scriptLength);

  const result = await cdpBridge.send('Runtime.callFunctionOn', {
    functionDeclaration,
    arguments: argsArray,
    awaitPromise: true,
    returnByValue: true,
    executionContextId: cdpBridge.contextId,
  });

  await syncMockStatus(args);

  return (result.result.value as ReturnValue) ?? undefined;
}

const syncMockStatus = async (args: unknown[]) => {
  const isInternalCommand = () => Boolean((args.at(-1) as ExecuteOpts)?.internal);
  const mocks = mockStore.getMocks();
  if (mocks.length > 0 && !isInternalCommand()) {
    await Promise.all(mocks.map(async ([_mockId, mock]) => mock.update()));
  }
};

// Remove first arg `electron` - Electron can be accessed as global scope.
const removeFirstArg = (funcStr: string) => {
  // generate AST
  const ast = parse(funcStr, {
    parser: {
      parse: (source: string) =>
        babelParser.parse(source, {
          sourceType: 'module',
          plugins: ['typescript'],
        }),
    },
  });

  let funcNode = null;
  const topLevelNode = ast.program.body[0];

  if (topLevelNode.type === 'ExpressionStatement') {
    // Arrow function
    funcNode = topLevelNode.expression;
  } else if (topLevelNode.type === 'FunctionDeclaration') {
    // Function declaration
    funcNode = topLevelNode;
  }

  if (!funcNode) {
    throw new Error('Unsupported function type');
  }

  // Remove first args `electron` if exists
  if ('params' in funcNode && Array.isArray(funcNode.params)) {
    funcNode.params.shift();
  }

  return print(ast).code;
};
