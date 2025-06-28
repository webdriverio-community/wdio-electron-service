# Example Applications

This directory contains example applications for demonstrating and testing the `wdio-electron-service` with different configurations:

## Application Types

- **Forge**: Examples using Electron Forge for packaging (`forge-esm`, `forge-cjs`)
- **Builder**: Examples using Electron Builder for packaging (`builder-esm`, `builder-cjs`)
- **No Binary**: Examples without packaging, direct Electron execution (`no-binary-esm`, `no-binary-cjs`)

Each application type has both ESM and CommonJS variants.

## Running Examples

After installing dependencies with PNPM, build and test any example:

```sh
cd fixtures/e2e-apps/forge-esm
pnpm build
pnpm wdio run wdio.conf.ts
```
