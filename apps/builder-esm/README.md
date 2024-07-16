# example-builder-esm

An ESM project for a minimal Electron app, designed to provide E2E testing for `wdio-electron-service`.

The app is built using `electron-builder` and the preload script is bundled as CJS, this is to work around a limitation of Electron's ESM support.
