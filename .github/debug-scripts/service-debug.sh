#!/bin/bash
set -e

# Service and Forge Build Debug
echo "=============== SERVICE AND FORGE BUILD DEBUG ==============="

# Check specific paths that should contain node typings
echo "Checking node_modules paths that should contain Node.js typings:"
NODE_MODULES_PATHS=(
  "./node_modules/@types/node"
  "./packages/wdio-electron-service/node_modules/@types/node"
)

# Add forge apps to the list if we're in a forge build
if [[ "$SCENARIO" == *"forge"* ]]; then
  for app in apps/forge*; do
    if [ -d "$app" ]; then
      NODE_MODULES_PATHS+=("$app/node_modules/@types/node")
    fi
  done
fi

# Check each path
for path in "${NODE_MODULES_PATHS[@]}"; do
  if [ -d "$path" ]; then
    echo "✅ Found node types at: $path"
    echo "Index.d.ts exists: $(test -f "$path/index.d.ts" && echo "Yes" || echo "No")"
    echo "Types version: $(cat "$path/package.json" | grep -o '"version": "[^"]*"' || echo "Version not found")"
  else
    echo "❌ Missing node types at: $path"
  fi
done

# Check rollup config to see how it references TypeScript
if [ -f "./packages/wdio-electron-service/rollup.config.ts" ]; then
  echo "Examining rollup config for TypeScript plugin configuration:"
  grep -A 10 "typescript" ./packages/wdio-electron-service/rollup.config.ts || echo "No typescript plugin found in rollup config"

  # Check compilerOptions in the typescript plugin if present
  grep -A 20 "compilerOptions" ./packages/wdio-electron-service/rollup.config.ts || echo "No compilerOptions found in rollup config"
fi

# Check tsconfig that might be referenced by rollup
if [ -f "./packages/wdio-electron-service/tsconfig.json" ]; then
  echo "Examining service package tsconfig.json:"
  cat ./packages/wdio-electron-service/tsconfig.json

  echo "Checking if tsconfig extends another config:"
  grep "extends" ./packages/wdio-electron-service/tsconfig.json || echo "tsconfig does not extend another config"

  # If it extends another config, check that one too
  EXTENDS_CONFIG=$(grep -o '"extends": *"[^"]*"' ./packages/wdio-electron-service/tsconfig.json | sed 's/"extends": *"//;s/"//g' || echo "")
  if [ ! -z "$EXTENDS_CONFIG" ]; then
    # Resolve relative path if needed
    if [[ "$EXTENDS_CONFIG" == ../* ]]; then
      EXTENDS_PATH="./packages/wdio-electron-service/$EXTENDS_CONFIG"
    elif [[ "$EXTENDS_CONFIG" == ./* ]]; then
      EXTENDS_PATH="./packages/wdio-electron-service/$EXTENDS_CONFIG"
    else
      EXTENDS_PATH="$EXTENDS_CONFIG"
    fi

    if [ -f "$EXTENDS_PATH" ]; then
      echo "Examining extended tsconfig at $EXTENDS_PATH:"
      cat "$EXTENDS_PATH"
    else
      echo "Extended tsconfig not found at $EXTENDS_PATH"
    fi
  fi
fi

# If this is a Forge app, check the app's tsconfig
if [[ "$SCENARIO" == *"forge"* ]]; then
  for app in apps/forge*; do
    if [ -d "$app" ]; then
      if [ -f "$app/tsconfig.json" ]; then
        echo "Examining $app tsconfig.json:"
        cat "$app/tsconfig.json"

        # Check for types field
        grep -o '"types": *\[[^]]*\]' "$app/tsconfig.json" || echo "No types field found in $app tsconfig"

        # Check for lib field
        grep -o '"lib": *\[[^]]*\]' "$app/tsconfig.json" || echo "No lib field found in $app tsconfig"
      else
        echo "No tsconfig.json found in $app"
      fi
    fi
  done
fi

# List all types packages installed
echo "All @types packages installed:"
find . -path "*/node_modules/@types" -type d | xargs ls -la 2>/dev/null || echo "No @types directories found"

# Check for TypeScript paths configuration
echo "Checking for TypeScript paths configuration:"
find . -name "tsconfig*.json" | xargs grep -l '"paths"' || echo "No paths configurations found"

# Test basic TypeScript compilation with node types
echo "Testing basic TypeScript compilation with node types:"
echo 'import * as fs from "fs"; console.log(fs.readFileSync("package.json", "utf8"));' > test-node-types.ts
npx tsc test-node-types.ts --traceResolution || echo "TypeScript compilation failed"
rm -f test-node-types.ts
