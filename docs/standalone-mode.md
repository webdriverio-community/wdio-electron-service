# Standalone Mode

You can also use the service without the WDIO testrunner, e.g. in a normal Node.js script.

The `startElectron` method accepts [`ElectronServiceOptions`](./configuration/service-configuration.md#service-options), creates a new WDIO session using your configuration and returns the WebdriverIO browser object:

```TS
import { startElectron } from 'wdio-electron-service';

const browser = await startElectron({
  appBinaryPath: '/path/to/binary',
  appArgs: ['foo', 'bar=baz'],
});

const appName = await browser.electron.execute((electron) => electron.app.getName());
```
