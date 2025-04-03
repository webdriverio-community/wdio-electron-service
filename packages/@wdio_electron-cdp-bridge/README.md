# WDIO CDP Bridge

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/@wdio/cdp-bridge)](https://www.npmjs.com/package/@wdio/cdp-bridge)
[![NPM Downloads](https://img.shields.io/npm/dw/@wdio/cdp-bridge)](https://www.npmjs.com/package/@wdio/cdp-bridge)

</div>

A lightweight connector for the Node debugger using the Chrome DevTools Protocol (CDP), designed for the [WebdriverIO Electron Service](https://github.com/webdriverio-community/wdio-electron-service).

## 📋 Table of Contents

- [WDIO CDP Bridge](#wdio-cdp-bridge)
  - [📋 Table of Contents](#-table-of-contents)
  - [📦 Installation](#-installation)
  - [🔍 Overview](#-overview)
  - [💻 Usage Examples](#-usage-examples)
    - [DevTool](#devtool)
    - [CdpBridge](#cdpbridge)
  - [📚 API Reference](#-api-reference)
    - [DevTool](#devtool-1)
      - [Constructor Options](#constructor-options)
      - [Methods](#methods)
        - [`version()`](#version)
        - [`list()`](#list)
    - [CdpBridge](#cdpbridge-1)
      - [Constructor Options](#constructor-options-1)
      - [Methods](#methods-1)
        - [`connect()`](#connect)
        - [`on(event, listener)`](#onevent-listener)
        - [`send(method, params?)`](#sendmethod-params)
        - [`close()`](#close)
        - [`state`](#state)
  - [🔧 Troubleshooting](#-troubleshooting)
    - [Connection Issues](#connection-issues)
    - [Command Failures](#command-failures)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)
  - [📚 Further Reading](#-further-reading)

## 📦 Installation

```bash
# Using npm
npm install @wdio/cdp-bridge

# Using yarn
yarn add @wdio/cdp-bridge

# Using pnpm
pnpm add @wdio/cdp-bridge
```

## 🔍 Overview

The CDP Bridge provides a simple interface for connecting to and interacting with the Node debugger through the Chrome DevTools Protocol (CDP). It offers:

- Automatic connection and reconnection to Node debugger instances
- Type-safe command execution with TypeScript support
- Event-based communication for receiving debugger events
- Lightweight implementation with minimal dependencies

This library is especially useful for:

- Debugging Electron applications
- Interacting with Node.js processes programmatically
- Automating DevTools operations in testing environments

## 💻 Usage Examples

### DevTool

The `DevTool` class provides a low-level interface for communicating with the Node debugger:

```ts
import { DevTool } from '@wdio/cdp-bridge';

// Initialize with default settings (localhost:9229)
const devTool = new DevTool();

// Or with custom settings
// const devTool = new DevTool({ host: 'localhost', port: 9229 });

// Get debugger version information
const version = await devTool.version();
console.log(version);
// Output:
// {
//   "browser": "node.js/v20.18.1",
//   "protocolVersion": "1.1"
// }

// List available debugging targets
const list = await devTool.list();
console.log(list);
// Output:
// [{
//   "description": "node.js instance",
//   // ...other properties
//   "webSocketDebuggerUrl": "ws://localhost:9229/31ab611d-a1e7-4149-94ba-ba55f6092d92"
// }]
```

### CdpBridge

The `CdpBridge` class provides a higher-level interface with event handling and typed commands:

```ts
import { CdpBridge } from '@wdio/cdp-bridge';

async function example() {
  // Initialize with default settings
  const cdp = new CdpBridge();

  // Connect to the debugger
  await cdp.connect();

  // Listen for specific CDP events
  const events = [];
  cdp.on('Runtime.executionContextCreated', (event) => {
    console.log('New execution context created:', event);
    events.push(event);
  });

  // Enable the Runtime domain to receive its events
  await cdp.send('Runtime.enable');

  // Execute JavaScript in the remote context
  const result = await cdp.send('Runtime.evaluate', {
    expression: '1 + 3',
    returnByValue: true,
  });

  console.log('Evaluation result:', result.result.value); // 4

  // Disable the Runtime domain when done
  await cdp.send('Runtime.disable');

  // Close the connection
  await cdp.close();
}

example().catch(console.error);
```

## 📚 API Reference

### DevTool

The `DevTool` class provides methods for basic CDP interactions.

#### Constructor Options

| Option    | Type     | Default       | Description                        |
| --------- | -------- | ------------- | ---------------------------------- |
| `host`    | `string` | `'localhost'` | Hostname of the debugger           |
| `port`    | `number` | `9229`        | Port number of the debugger        |
| `timeout` | `number` | `10000`       | Connection timeout in milliseconds |

#### Methods

##### `version()`

Returns version metadata about the debugger.

```ts
const versionInfo = await devTool.version();
```

Return value:

```json
{
  "browser": "node.js/v20.18.1",
  "protocolVersion": "1.1"
}
```

##### `list()`

Returns a list of all available WebSocket debugging targets.

```ts
const debugTargets = await devTool.list();
```

Return value:

```json
[
  {
    "description": "node.js instance",
    "devtoolsFrontendUrl": "devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:9229/9b3ce98c-082f-4555-8c1b-e50d3fdddf42",
    "devtoolsFrontendUrlCompat": "devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:9229/9b3ce98c-082f-4555-8c1b-e50d3fdddf42",
    "faviconUrl": "https://nodejs.org/static/images/favicons/favicon.ico",
    "id": "9b3ce98c-082f-4555-8c1b-e50d3fdddf42",
    "title": "electron/js2c/browser_init",
    "type": "node",
    "url": "file://",
    "webSocketDebuggerUrl": "ws://localhost:9229/9b3ce98c-082f-4555-8c1b-e50d3fdddf42"
  }
]
```

### CdpBridge

The `CdpBridge` class provides a higher-level interface for CDP communication.

#### Constructor Options

| Option                 | Type     | Default       | Description                                 |
| ---------------------- | -------- | ------------- | ------------------------------------------- |
| `host`                 | `string` | `'localhost'` | Hostname of the debugger                    |
| `port`                 | `number` | `9229`        | Port number of the debugger                 |
| `timeout`              | `number` | `10000`       | Request timeout in milliseconds             |
| `waitInterval`         | `number` | `100`         | Retry interval in milliseconds              |
| `connectionRetryCount` | `number` | `3`           | Maximum number of connection retry attempts |

#### Methods

##### `connect()`

Establishes a connection to the debugger. Automatically retries on failure based on the `connectionRetryCount` setting.

```ts
await cdpBridge.connect();
```

##### `on(event, listener)`

Registers an event listener for CDP events.

| Parameter  | Type                    | Description                                              |
| ---------- | ----------------------- | -------------------------------------------------------- |
| `event`    | `string`                | CDP event name (e.g., `Runtime.executionContextCreated`) |
| `listener` | `(params: any) => void` | Callback function that receives event parameters         |

```ts
cdpBridge.on('Runtime.executionContextCreated', (context) => {
  console.log('New context:', context);
});
```

##### `send(method, params?)`

Sends a CDP command and returns the result. Fully typed with TypeScript when using appropriate type imports.

| Parameter | Type     | Description                                           |
| --------- | -------- | ----------------------------------------------------- |
| `method`  | `string` | CDP method name (e.g., `Runtime.evaluate`)            |
| `params`  | `object` | Optional parameters for the command (method-specific) |

```ts
const result = await cdpBridge.send('Runtime.evaluate', {
  expression: 'document.title',
  returnByValue: true,
});
```

##### `close()`

Closes the WebSocket connection to the debugger.

```ts
await cdpBridge.close();
```

##### `state`

Property that returns the current WebSocket connection state:

- `undefined`: Not connected
- `0` (`WebSocket.CONNECTING`): Connection in progress
- `1` (`WebSocket.OPEN`): Connection established
- `2` (`WebSocket.CLOSING`): Connection closing
- `3` (`WebSocket.CLOSED`): Connection closed

```ts
const connectionState = cdpBridge.state;
```

## 🔧 Troubleshooting

### Connection Issues

If you're having trouble connecting to the debugger:

1. **Verify the debugger is running**: Make sure your Node/Electron process is started with the `--inspect` or `--inspect-brk` flag.

2. **Check port availability**: The default port (9229) might be in use. Try specifying a different port.

3. **Connection timeout**: Increase the `timeout` value if you're experiencing timeouts.

   ```ts
   const cdp = new CdpBridge({ timeout: 30000 }); // 30 seconds
   ```

4. **Retry settings**: Adjust the retry count and interval for unstable connections.

   ```ts
   const cdp = new CdpBridge({
     connectionRetryCount: 5,
     waitInterval: 500, // 500ms between retries
   });
   ```

### Command Failures

If CDP commands are failing:

1. **Check domain initialization**: Some commands require their domain to be enabled first.

   ```ts
   // Enable the domain before using its commands
   await cdp.send('Runtime.enable');
   ```

2. **Verify method name**: Ensure you're using the correct method name and parameter structure.

3. **Connection state**: Make sure the connection is in the `OPEN` state before sending commands.

   ```ts
   if (cdp.state === 1) {
     // WebSocket.OPEN
     await cdp.send('Runtime.evaluate', {
       /* params */
     });
   }
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📚 Further Reading

- [Chrome DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/) - Official CDP documentation
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/) - Guide to Node.js debugging
- [WebdriverIO Documentation](https://webdriver.io/docs/api) - WebdriverIO API documentation
