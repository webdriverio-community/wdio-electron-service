# example-forge-cjs

A CJS project for a minimal Electron app, designed to provide E2E testing for `wdio-electron-service`.

The app is built using Electron Forge and both preload and main scripts are bundled. This is to avoid errors being thrown in the build step since Forge does not have good PNPM support.
