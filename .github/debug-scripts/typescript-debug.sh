#!/bin/bash
set -e

# First build debug - check if there's a bundler module
echo "=============== DETAILED BUNDLER DEBUG ==============="
if [ -d "./packages/wdio-electron-bundler" ]; then
  echo "Found bundler in packages/wdio-electron-bundler"
  ls -la ./packages/wdio-electron-bundler

  echo "Checking package.json:"
  cat ./packages/wdio-electron-bundler/package.json

  echo "Checking if bundler is built:"
  if [ -d "./packages/wdio-electron-bundler/dist" ]; then
    echo "Bundler is built, dist directory exists"
    ls -la ./packages/wdio-electron-bundler/dist
  else
    echo "Bundler is not built, dist directory is missing"
  fi
fi

if [ -d "./packages/@wdio/electron-bundler" ]; then
  echo "Found bundler in packages/@wdio/electron-bundler"
  ls -la ./packages/@wdio/electron-bundler
fi

# TypeScript diagnostics
echo "=============== TYPESCRIPT DIAGNOSTICS ==============="

# Check if forge builds are being run
if [[ "$SCENARIO" == *"forge"* ]]; then
  echo "Forge app detected in scenario: $SCENARIO"
else
  echo "Non-Forge app in scenario: $SCENARIO"
fi

# Examine TypeScript configuration
echo "Looking for TypeScript configuration files:"
find . -name "tsconfig*.json" | xargs -I{} echo "Found TypeScript config: {}"

# Check if TypeScript references node types
echo "Looking for @types/node in TypeScript config files:"
find . -name "tsconfig*.json" | xargs grep -l "@types/node" || echo "No TypeScript config files with @types/node found"

# Check if TypeScript can resolve @types/node
echo "Checking if TypeScript can resolve @types/node:"
echo "const ts = require('typescript'); console.log('TypeScript compiler paths:', ts.sys.getDirectories(require('path').join(process.cwd(), 'node_modules', '@types')).join('\\n'));" > ts-paths.js
node ts-paths.js || echo "Failed to run TypeScript path resolution check"

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
rm -f ts-paths.js
