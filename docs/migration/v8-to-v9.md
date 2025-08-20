# Migration Guide: v8 → v9

This guide highlights the changes when moving from v8 to v9 and actions needed for smooth upgrades.

## CDP bridge only (IPC bridge removed)

The service now uses only the Chrome DevTools Protocol (CDP) to communicate with the Electron main process. There are no public API changes required for typical users. If for some reason you previously relied on IPC bridge internals, please migrate to the public API (`browser.electron.execute`, etc.).

### Removed IPC bridge imports

The following imports are no longer provided in v9:

- `wdio-electron-service/preload`
- `wdio-electron-service/main`

Unlike the IPC bridge, the CDP bridge functions without requiring these modules. If your application imported these helpers, remove the imports; your tests should continue to work using the standard service API.

## Electron Fuses: Node CLI Inspect arguments

If your application flips the Electron fuse `EnableNodeCliInspectArguments*` to `false`, the Node CLI `--inspect` argument is disabled. The service’s CDP bridge relies on this mechanism to connect. Disabling it prevents the bridge from working.

- Action: ensure the fuse remains enabled for test builds.
- Reference: [Electron fuses – “EnableNodeCliInspectArguments*”](https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect)


