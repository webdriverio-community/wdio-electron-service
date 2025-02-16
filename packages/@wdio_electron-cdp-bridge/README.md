# WDIO CDP Bridge

<a href="https://www.npmjs.com/package/@wdio/cdpーbridge" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@wdio/cdpーbridge" /></a>
<a href="https://www.npmjs.com/package/@wdio/cdpーbridge" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@wdio/cdpーbridge" /></a>

<br />

**Connector for Node debugger for the [WDIO Electron Service](https://github.com/webdriverio-community/wdio-electron-service)**

## Overview

This library lets you connect to the Node debugger using the Chrome developer protocol (CDP).
This is a simple interface and a lightweight (few dependencies) library.

## Sample Usage

### `DevTool`

```ts
const devTool = new DevTool({ host: 'localhost', port: 9229 });

const version = devTool.version();
console.log(version);
// output
{
  "browser": "node.js/v20.18.1",
  "protocolVersion": "1.1"
}

const list = devTool.list();
console.log(list);
// output
[ {
  "description": "node.js instance",
  // Omitted
  "webSocketDebuggerUrl": "ws://localhost:9229/31ab611d-a1e7-4149-94ba-ba55f6092d92"
} ]
```

### `CdpBridge`

```ts
const cdp = new CdpBridge({ host: 'localhost', port: 9229 });

const events = [];
const callback = (event) => {
  events.push(event);
};
cdp.on('Runtime.executionContextCreated', callback); // receive events

cdp.send('Runtime.enable');
cdp.send('Runtime.disable');

// we can get support of typescript
const result = await this.sendMethod('Runtime.evaluate', {
  requestParams: {
    expression: `1 + 3`,
  },
});

console.log(result.result.value); // expected 3
```

## API

### `DevTool`

Communication tool for the Node debugger using CDP.

#### constructor(options)

Constructor options:
| Option |type|Default value| Description |
|--------|-------------|:--------:|----------|
| `host` |string|localhost| Hostname of the debugger |
| `port` |number |9229| Port number of the debugger |
| `timeout` |number|10000| Timeout for connection (ms) |

#### `version()`

Version metadata

```json
{
  "browser": "node.js/v20.18.1",
  "protocolVersion": "1.1"
}
```

#### `list()`

**_Execute `GET /json/list`_**

A list of all available websocket targets.

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

### `CdpBridge`

#### constructor(options)

Constructor options:
| Option |type|Default value| Description |
|--------|-------------|:--------:|----------|
| `host` |string|localhost| Hostname of the debugger |
| `port` |number |9229| Port number of the debugger |
| `timeout` |number|10000| Timeout for connection (ms) |

#### `connect()`

Detect websocket URL for a debugger and initialise the websocket connection.

#### `on(method, callback)`

| Option     | type            | Description                                                      |
| ---------- | --------------- | ---------------------------------------------------------------- |
| `method`   | string          | Event name. (e.g. `Runtime.executionContextCreated`)             |
| `callback` | (prams) => void | callback for event happen. Params can receive as first argument. |

#### `send(method, params)`

| Option     | type                | Description                           |
| ---------- | ------------------- | ------------------------------------- |
| `method`   | string              | Event name. (e.g. `Runtime.evaluate`) |
| `callback` | -(depend on method) | Parameters of the method.             |

See also [the document](https://chromedevtools.github.io/devtools-protocol/).
