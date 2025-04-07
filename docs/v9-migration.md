# From v8 to v9

This tutorial is for people who are still using v8 of wdio-electron-service and want to migrate to v9.

## Upgrade wdio-electron-service Dependencies

Upgrade this service via:

```
npm i --save-dev wdio-electron-service@v9
```

## Remove importing preload/main script

Until v8 was required to import the preload/main script to accessing electron api.
However, it is no longer necessary to import those scripts to achieve this.
This ensures that no extra code is included in the build and that tests can be run directly against the production application build.

### `main.ts`

```diff
- if (isTest) {
-   await import('wdio-electron-service/main');
- }
```

### `preload.ts`

```diff
- if (isTest) {
-   await import('wdio-electron-service/preload');
- }
```

## Build electron apps and run E2E test

If necessary, build and test the application with the imports removed.

```bash
$ npm build
$ wdio run ./wdio.conf.ts
```
