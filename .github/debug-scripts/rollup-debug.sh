#!/bin/bash
set -e

# Rollup TypeScript Debug
echo "=============== ROLLUP TYPESCRIPT DEBUG ==============="

# Check if forge builds are being run
if [[ "$SCENARIO" == *"forge"* ]]; then
  echo "Forge app detected in scenario: $SCENARIO"
else
  echo "Non-Forge app in scenario: $SCENARIO"
fi

# Examine rollup configuration
echo "Looking for rollup configuration files:"
find . -name "rollup.config.*" | xargs -I{} echo "Found rollup config: {}"

# If we find the service package rollup config, examine it
if [ -f "./packages/wdio-electron-service/rollup.config.ts" ]; then
  echo "Contents of service package rollup config:"
  cat ./packages/wdio-electron-service/rollup.config.ts

  echo "Checking rollup typescript plugin version:"
  pnpm list @rollup/plugin-typescript -r || echo "Plugin not found"

  echo "Checking typescript version:"
  pnpm list typescript -r || echo "TypeScript not found"
fi

# Check if tsconfig references node types
echo "Looking for tsconfig files that reference node types:"
find . -name "tsconfig*.json" | xargs grep -l "node" || echo "No tsconfig references to node found"

# Print package.json dependences related to typescript and node types
echo "Looking for @types/node in package.json files:"
find . -name "package.json" | xargs grep -l "@types/node" || echo "No package.json files with @types/node found"

# Check TypeScript compiler resolution paths
echo "TypeScript compiler node resolution paths:"
echo "const ts = require('typescript'); console.log('TypeScript compiler paths:', ts.sys.getDirectories(require('path').join(process.cwd(), 'node_modules', '@types')).join('\\n'));" > ts-paths.js
node ts-paths.js || echo "Failed to run TypeScript path resolution check"

# Check if Rollup can resolve @types/node
echo "Checking if Rollup can resolve @types/node:"
echo "try { const rollup = require('rollup'); console.log('Rollup version:', rollup.VERSION); const plugin = require('@rollup/plugin-typescript'); console.log('TypeScript plugin found:', !!plugin); } catch (e) { console.log('Error:', e.message); }" > rollup-test.js
node rollup-test.js || echo "Failed to run Rollup resolution test"

# Check if there are multiple node_modules directories with conflicting types
echo "Searching for multiple @types/node installations:"
find . -path "*/node_modules/@types/node" | sort

echo "Searching for node.d.ts files:"
find . -name "node.d.ts" | sort

# Check if we're on Forge app and examine Forge-specific build configs
if [[ "$SCENARIO" == *"forge"* ]]; then
  echo "Examining Forge-specific configs:"

  # Find Forge config files
  find . -name "forge.config.*" | xargs -I{} echo "Found Forge config: {}"

  # Check for Forge-specific dependencies
  echo "Forge-related dependencies:"
  pnpm list electron-forge -r || echo "electron-forge not found"
  pnpm list electron-builder -r || echo "electron-builder not found"

  # Check if Forge and Electron versions are compatible
  echo "Checking Forge and Electron versions:"
  pnpm list electron -r || echo "electron not found"

  # Check if the apps are using native modules which might affect TypeScript builds
  echo "Checking for native/node-gyp dependencies:"
  find . -name "binding.gyp" || echo "No binding.gyp files found"
fi

# Clean up
rm -f ts-paths.js rollup-test.js
