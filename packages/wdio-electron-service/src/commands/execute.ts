import { DebuggerClient } from '../electron.js';
// import log from '@wdio/electron-utils/log';
import * as babelParser from '@babel/parser';
import { print, parse } from 'recast';
import { ExecuteOpts } from '@wdio/electron-types';
import mockStore from '../mockStore.js';

export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  debuggerClient: DebuggerClient,
  script: string | ((...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue | undefined> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialized');
  }

  if (browser.isMultiremote) {
    throw new Error('Multiremote browser is not support. please specify the browser');
  }

  const functionDeclaration = removeFirstArg(script.toString());

  const argsArray = args.map((arg) => ({ value: arg }));

  const result = await debuggerClient.sendMethod('Runtime.callFunctionOn', {
    functionDeclaration,
    arguments: argsArray,
    awaitPromise: true,
    returnByValue: true,
  });

  await syncMockStatus(args);

  return (result as ReturnValue) ?? undefined;
}

const syncMockStatus = async (args: unknown[]) => {
  const isInternalCommand = () => Boolean((args.at(-1) as ExecuteOpts)?.internal);
  const mocks = mockStore.getMocks();
  if (mocks.length > 0 && !isInternalCommand()) {
    await Promise.all(mocks.map(async ([_mockId, mock]) => await mock.update()));
  }
};

//remove first arg `electron`. electron is added to global scope.
const removeFirstArg = (funcStr: string) => {
  // generate ATS
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
    // iife
    funcNode = topLevelNode.expression;
  } else if (topLevelNode.type === 'FunctionDeclaration') {
    // function
    funcNode = topLevelNode;
  } else if (topLevelNode.type === 'VariableDeclaration') {
    // Arrow function
    const declaration = topLevelNode.declarations[0];
    if (declaration.init?.type === 'ArrowFunctionExpression' || declaration.init?.type === 'FunctionExpression') {
      funcNode = declaration.init;
    }
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
