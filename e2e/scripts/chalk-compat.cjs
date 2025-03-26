/**
 * This script provides compatibility for ESM-only modules like chalk, strip-ansi, etc.
 * when running in CommonJS mode. It works by intercepting module imports and providing
 * compatible mock implementations.
 */

console.log('🔍 DEBUG: Loading ESM compatibility patch...');

// Simple chalk mock that just returns the input string for all color methods
const createChalkMock = () => {
  const fn = (text) => text;
  const colors = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'gray',
    'grey',
    'blackBright',
    'redBright',
    'greenBright',
    'yellowBright',
    'blueBright',
    'magentaBright',
    'cyanBright',
    'whiteBright',
    'bgBlack',
    'bgRed',
    'bgGreen',
    'bgYellow',
    'bgBlue',
    'bgMagenta',
    'bgCyan',
    'bgWhite',
    'bgBlackBright',
    'bgRedBright',
    'bgGreenBright',
    'bgYellowBright',
    'bgBlueBright',
    'bgMagentaBright',
    'bgCyanBright',
    'bgWhiteBright',
    'reset',
    'bold',
    'dim',
    'italic',
    'underline',
    'inverse',
    'hidden',
    'strikethrough',
    'visible',
  ];

  // Add each color as a function property that just returns the text
  colors.forEach((color) => {
    fn[color] = fn;
  });

  // Add support for method chaining
  colors.forEach((color) => {
    Object.defineProperty(fn, color, {
      get() {
        return fn;
      },
    });
  });

  // Support the default export pattern too
  fn.default = fn;

  return fn;
};

// Simple strip-ansi mock that just returns the input string
const createStripAnsiMock = () => {
  const stripAnsi = (text) => (text && typeof text === 'string' ? text : String(text || ''));
  stripAnsi.default = stripAnsi;
  return stripAnsi;
};

// Mock implementation of node-util
function createNodeUtilMock() {
  // Create format function with proper apply method
  const format = function () {
    // Basic implementation of format that joins arguments with spaces
    if (arguments.length === 0) return '';

    const firstArg = arguments[0];
    if (typeof firstArg !== 'string') {
      return Array.from(arguments).map(String).join(' ');
    }

    // Very simple formatter
    return Array.from(arguments).map(String).join(' ');
  };

  // Make sure format has an apply method
  format.apply = function (thisArg, argsArray) {
    return format(...argsArray);
  };

  // Add formatWithOptions function
  const formatWithOptions = function (options, ...args) {
    // Simple implementation that just uses format
    return format(...args);
  };

  // Add types object with isPromise method
  const types = {
    isPromise: function (value) {
      return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.then === 'function' &&
        typeof value.catch === 'function'
      );
    },
    isProxy: (value) => {
      // Simple mock implementation that always returns false
      // since we can't actually detect proxies in this environment
      return false;
    },
  };

  return {
    // Add types object
    types: types,

    // Add isPromise function at top level for backward compatibility
    isPromise: types.isPromise,

    // Add format function with apply method
    format: format,

    // Add formatWithOptions function
    formatWithOptions: formatWithOptions,

    // Add debuglog function that just returns console.debug
    debuglog: function (section) {
      return function (...args) {
        if (process.env.NODE_DEBUG && (process.env.NODE_DEBUG === '*' || process.env.NODE_DEBUG.includes(section))) {
          console.debug(`${section} ${format(...args)}`);
        }
        // Return a noop function when debuglog is disabled
        return function () {};
      };
    },

    // Add promisify function
    promisify: function (fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('The argument to promisify must be a function');
      }

      return function (...args) {
        return new Promise((resolve, reject) => {
          fn(...args, (err, ...result) => {
            if (err) return reject(err);
            if (result.length === 1) return resolve(result[0]);
            return resolve(result);
          });
        });
      };
    },

    // Add inherits function
    inherits: function (ctor, superCtor) {
      if (ctor === null || typeof ctor !== 'function')
        throw new TypeError('The constructor to "inherits" must not be null or undefined');

      if (superCtor === null || typeof superCtor !== 'function')
        throw new TypeError('The super constructor to "inherits" must not be null or undefined');

      if (superCtor.prototype === undefined)
        throw new TypeError('The super constructor to "inherits" must have a prototype');

      ctor.super_ = superCtor;
      Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
    },

    // Add deprecate function
    deprecate: function (fn, msg) {
      // Simple implementation that just returns the original function
      return fn;
    },

    // Add inspect function
    inspect: function (obj) {
      return JSON.stringify(obj);
    },
  };
}

// Mock implementation of the @wdio/logger module
function createLoggerMock() {
  // Create a basic logger function that returns a logger object
  const createLogger = (name) => {
    // Create basic logger methods
    const logger = {
      error: (...args) => console.error(`[${name}]`, ...args),
      warn: (...args) => console.warn(`[${name}]`, ...args),
      info: (...args) => console.info(`[${name}]`, ...args),
      debug: (...args) => console.debug(`[${name}]`, ...args),
      trace: (...args) => console.trace(`[${name}]`, ...args),
      silent: () => {},
    };

    return logger;
  };

  // Make it the default export
  createLogger.default = createLogger;

  return createLogger;
}

// Create a dedicated mock for @wdio/electron-utils/log
function createElectronUtilsLogMock() {
  // Create a mock log object with all required methods
  return {
    error: (...args) => console.error('[electron-service]', ...args),
    warn: (...args) => console.warn('[electron-service]', ...args),
    info: (...args) => console.info('[electron-service]', ...args),
    debug: (...args) => console.debug('[electron-service]', ...args),
    trace: (...args) => console.trace('[electron-service]', ...args),
    silent: () => {},
  };
}

// Only apply the patch if in CommonJS + compatibility mode
if (process.env.WDIO_CHALK_COMPAT === 'true') {
  console.log('🔍 DEBUG: ESM compatibility mode enabled');

  // Create mock objects
  const chalk = createChalkMock();
  const stripAnsi = createStripAnsiMock();
  const nodeUtil = createNodeUtilMock();
  const logger = createLoggerMock();
  const electronUtilsLog = createElectronUtilsLogMock();

  // Store the original require function
  const originalRequire = module.require;

  // Get Module constructor
  const Module = module.constructor;

  // Track which modules we've already logged
  const loggedModules = new Set();

  // Override Module.prototype.require to intercept module loading
  Module.prototype.require = function (id) {
    if (id === 'chalk' && !loggedModules.has('chalk')) {
      console.log('🔍 DEBUG: Intercepted chalk import, providing compatibility mock');
      loggedModules.add('chalk');
      return chalk;
    }

    if (id === 'strip-ansi' && !loggedModules.has('strip-ansi')) {
      console.log('🔍 DEBUG: Intercepted strip-ansi import, providing compatibility mock');
      loggedModules.add('strip-ansi');
      return stripAnsi;
    }

    if ((id === 'node:util' || id === 'util') && !loggedModules.has('node:util')) {
      console.log('🔍 DEBUG: Intercepted node:util import, providing compatibility mock');
      loggedModules.add('node:util');
      return nodeUtil;
    }

    if (id === '@wdio/logger' && !loggedModules.has('@wdio/logger')) {
      console.log('🔍 DEBUG: Intercepted @wdio/logger import, providing compatibility mock');
      loggedModules.add('@wdio/logger');
      return logger;
    }

    // Special case for the log module from electron-utils
    if (id === '@wdio/electron-utils/log' && !loggedModules.has('@wdio/electron-utils/log')) {
      console.log('🔍 DEBUG: Intercepted @wdio/electron-utils/log import, providing compatibility mock');
      loggedModules.add('@wdio/electron-utils/log');
      return electronUtilsLog;
    }

    // Call the original require
    const originalModule = originalRequire.apply(this, arguments);

    // Patch @wdio/logger module if loaded - this is no longer needed since we're intercepting directly
    if (id.includes('@wdio/logger')) {
      console.log('🔍 DEBUG: Patching @wdio/logger module is now handled by direct interception');
    }

    return originalModule;
  };

  console.log('✅ ESM compatibility patch applied');

  // Patch the global object to ensure mocks are available
  global.chalk = chalk;
  global.import_chalk = { default: chalk };
  global.stripAnsi = stripAnsi;
  global.import_strip_ansi = { default: stripAnsi };
  global.nodeUtil = nodeUtil;
  global.import_node_util = { default: nodeUtil };
}
