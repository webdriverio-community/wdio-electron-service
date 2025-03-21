# Example Applications

This directory contains example applications for demonstrating and testing the `wdio-electron-service` with different configurations:

## Application Types

- **Forge**: Examples using Electron Forge for packaging (`forge-esm`, `forge-cjs`)
- **Builder**: Examples using Electron Builder for packaging (`builder-esm`, `builder-cjs`)
- **No Binary**: Examples without packaging, direct Electron execution (`no-binary-esm`, `no-binary-cjs`)

Each application type has both ESM and CommonJS variants.

## Dependency Management with Named Catalogs

These examples use PNPM's named catalogs to maintain consistent dependency versions across applications. Each example app references catalog versions defined in the root `pnpm-workspace.yaml`.

### Available Catalogs

1. **`default`**: Production-ready configuration using stable versions

   - Example: `electron: "catalog:default"` (resolves to version ^32.0.1)
   - Provides a reliable, well-tested baseline

2. **`next`**: Forward-looking configuration with latest versions

   - Example: `electron-nightly: "catalog:next"` (latest nightly builds)
   - Validates compatibility with upcoming changes

3. **`minimum`**: Lowest supported versions
   - Example: `electron: "catalog:minimum"` (version ^28.0.0)
   - Ensures backward compatibility

## Switching Between Catalogs

All example apps use the `default` catalog by default. To switch all examples to use a different catalog, run one of these commands from the project root:

```sh
# Switch to default catalog (stable versions)
pnpm catalog:default

# Switch to next catalog (latest/nightly versions)
pnpm catalog:next

# Switch to next catalog AND update to latest package versions
pnpm catalog:next:update

# Switch to minimum catalog (lowest supported versions)
pnpm catalog:minimum
```

The `catalog:next:update` command will prompt you to update the `next` catalog in the workspace with:

- Latest electron-nightly version fetched from npm
- All other packages are intelligently set to use the most appropriate tag:
  - Checks all available tags (next, beta, alpha, latest) for each package
  - Compares full semantic versions (major.minor.patch) to find the highest version across all tags
  - When multiple tags have the exact same version, prioritizes cutting-edge tags in order: next > beta > alpha > latest
  - This ensures you're always testing against the most forward-looking stable version available
- Removes electron dependency since only electron-nightly is used in this catalog

These commands update all example apps and run `pnpm install` to apply the changes.

## Running Examples

After installing dependencies with PNPM, build and test any example:

```sh
cd apps/forge-esm
pnpm build
pnpm wdio run wdio.conf.ts
```
