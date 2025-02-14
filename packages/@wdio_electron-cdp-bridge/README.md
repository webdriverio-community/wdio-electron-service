# wdio-node-debugger-driver

## Concept Image (DRAFT)

```ts
const devTool = new DevTool({ host: 'localhost', port: 9229 });

const list = devTool.list();
console.log(list);
/*
[ {
  "description": "node.js instance",
  "devtoolsFrontendUrl": "devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:9229/31ab611d-a1e7-4149-94ba-ba55f6092d92",
  "devtoolsFrontendUrlCompat": "devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:9229/31ab611d-a1e7-4149-94ba-ba55f6092d92",
  "faviconUrl": "https://nodejs.org/static/images/favicons/favicon.ico",
  "id": "31ab611d-a1e7-4149-94ba-ba55f6092d92",
  "title": "electron/js2c/browser_init",
  "type": "node",
  "url": "file://",
  "webSocketDebuggerUrl": "ws://localhost:9229/31ab611d-a1e7-4149-94ba-ba55f6092d92"
} ]
*/

const version = devTool.version();
console.log(version);
/*
{
  "Browser": "node.js/v20.18.1",
  "Protocol-Version": "1.1"
} 
*/
```

```ts
const cdp = new CdpSession(list[0].webSocketDebuggerUrl);

const events = [];
const callback = (event) => {
  events.push(event);
};

cdp.send('Runtime.enable', {}, { callback });
cdp.send('Runtime.disable');

// some processing to events... for example get correct execution contextIds...

const result = await this.sendMethod('Runtime.evaluate', {
  requestParams: {
    expression: scripts.join('\n'),
    includeCommandLineAPI: true,
    replMode: true,
    contextId: this.#contextId,
    // throwOnSideEffect: true,
  },
});

// we can get support of typescript
console.log(result.message);
```
