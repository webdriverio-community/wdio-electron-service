## Common Issues & Debugging

These are some common issues which others have encountered whilst using the service.

If you need extra insight into what the service is doing you can enable namespaced debug logging via the `DEBUG` environment variable.

- `DEBUG=wdio-electron-service` is equivalent to `DEBUG=wdio-electron-service:*` (enable all service namespaces)
- You can target specific areas, e.g. `DEBUG=wdio-electron-service:service,mock`

Examples:

```bash
# enable all service logs
DEBUG=wdio-electron-service:* wdio run ./wdio.conf.ts

# enable only core service + mocks
DEBUG=wdio-electron-service:service,mock wdio run ./wdio.conf.ts
```

Logs are also forwarded into WDIO runner logs under your configured `outputDir`.

This is utilising the [`debug`](https://github.com/debug-js/debug) logging package.

### CDP bridge cannot be initialized: EnableNodeCliInspectArguments fuse is disabled

This warning appears when your Electron app has the `EnableNodeCliInspectArguments` fuse explicitly disabled. The CDP (Chrome DevTools Protocol) bridge relies on the `--inspect` flag to connect to Electron's main process, so when this fuse is disabled, the service cannot provide access to the main process APIs.

#### Impact

When this fuse is disabled:
- ❌ `browser.electron.execute()` - main process API access will not work
- ❌ `browser.electron.mock()` - mocking main process APIs will not work
- ✅ Renderer process testing continues to work normally

#### Solution

Enable the fuse in your test builds. If you're disabling this fuse for production (which is good security practice), use conditional configuration:

```typescript
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';

await flipFuses(require('electron'), {
  version: FuseVersion.V1,
  [FuseV1Options.EnableNodeCliInspectArguments]: process.env.BUILD_FOR_TESTS === 'true',
  // ... other fuses
});
```

Then build with the environment variable, e.g.:
```bash
BUILD_FOR_TESTS=true npm run build  # for testing
npm run build                       # for production
```

See: [Electron Fuses Documentation](https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect)

### DevToolsActivePort file doesn't exist

This is a Chromium error which may appear when using Docker or CI. Most of the "fixes" discussed online are based around passing different combinations of args to Chromium - you can set these via [`appArgs`](./configuration/service-configuration.md#appargs-string), though in most cases using xvfb has proven to be more effective; the service itself uses xvfb when running E2Es on Linux CI.

See this [WDIO documentation page](https://webdriver.io/docs/headless-and-xvfb) for instructions on how to set up xvfb.

**Note:** WebdriverIO 9.19.1+ is required for automatic Xvfb support via the `autoXvfb` configuration option. For legacy WDIO versions, you'll need to use external tools like `xvfb-maybe` or manually set up Xvfb.

### Failed to create session. session not created: probably user data directory is already in use, please specify a unique value for --user-data-dir argument, or don't use --user-data-dir

This is another obscure Chromium error which, despite the message, is usually not fixed by providing a unique `--user-data-dir` value. In the Electron context this usually occurs when the Electron app crashes during or shortly after initialization. WDIO / ChromeDriver attempts to reconnect, starting a new electron instance, which attempts to use the same user-data-dir path. Whilst there may be other causes, on Linux this is often fixed with xvfb.

See this [WDIO documentation page](https://webdriver.io/docs/headless-and-xvfb) for instructions on how to set up xvfb.

**Note:** WebdriverIO 9.19.1+ is required for automatic Xvfb support via the `autoXvfb` configuration option. For legacy WDIO versions, you'll need to use external tools like `xvfb-maybe` or manually set up Xvfb.

### All versions of Electron fail to open on Ubuntu 24.04+

See [this issue](https://github.com/electron/electron/issues/41066) for more details. This is caused by AppArmor restrictions on unprivileged user namespaces.

#### Recommended Solution: Automatic AppArmor Profile

The service can automatically create and install a custom AppArmor profile for your Electron binary. Enable this feature by setting the `apparmorAutoInstall` option:

```ts
export const config = {
  // ...
  services: [
    [
      'electron',
      {
        apparmorAutoInstall: 'sudo' // or true if running as root
      }
    ]
  ],
  // OR configure it per capability:
  capabilities: [
    {
      'browserName': 'electron',
      'wdio:electronServiceOptions': {
        apparmorAutoInstall: 'sudo'
      }
    }
  ]
};
```

- `'sudo'`: Install if root or via non-interactive sudo (`sudo -n`) if available
- `true`: Install only if running as root (no sudo)
- `false` (default): Never install; warn and continue without AppArmor profile

#### Alternative Solution

**Manual AppArmor workaround**: Run `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` before running your tests. This command requires root privileges; if necessary, run it as the root user or use the `sudo` command.

### TypeError: logger is not a function

This error occurs when importing the `browser` object directly at the top level of test files:

```typescript
// ❌ This may cause "TypeError: logger is not a function"
import { browser } from "wdio-electron-service";

describe("My Tests", () => {
  it("should work", async () => {
    await browser.electron.execute(/* ... */);
  });
});
```

The service's internal logger and other dependencies aren't fully initialized when the browser object is imported during the test file loading phase, before WebDriverIO services have completed their initialization.

The solution is to use dynamic import within a `before` hook to ensure the service is fully initialized:

```typescript
// ✅ Correct approach - dynamic import in before hook
import type { Mock } from "@vitest/spy";
import { $, expect } from "@wdio/globals";
import type { browser as WdioBrowser } from "wdio-electron-service";

let browser: typeof WdioBrowser;

describe("My Tests", () => {
  before(async () => {
    ({ browser } = await import("wdio-electron-service"));
  });

  it("should work", async () => {
    await browser.electron.execute(/* ... */);
  });
});
```

**Note for Service Contributors:** If you're working within the wdio-electron-service repository itself, you can use pnpm overrides to link to the workspace version:

```json
{
  "pnpm": {
    "overrides": {
      "wdio-electron-service": "workspace:*"
    }
  }
}
```

This allows direct imports to work reliably within the service's own repository, but this approach only applies when developing the service itself.
