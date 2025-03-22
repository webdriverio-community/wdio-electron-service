#!/bin/bash
set -e

# Rollup Detailed Configuration Debug
echo "=============== ROLLUP DETAILED CONFIGURATION DEBUG ==============="

# Check for rollup.config.ts file in the service package
if [ -f "./packages/wdio-electron-service/rollup.config.ts" ]; then
  # Install dependencies for the test script
  echo "Installing dependencies for rollup debugging..."
  npm install --no-save typescript @rollup/plugin-typescript rollup

  # Create a script to analyze rollup configuration
  cat > rollup-debug.js << 'EOF'
  const fs = require('fs');
  const path = require('path');
  const ts = require('typescript');
  const rollup = require('rollup');

  console.log('TypeScript version:', ts.version);
  console.log('Rollup version:', rollup.VERSION);

  // Examine the TypeScript compiler host environment
  console.log('\nTypeScript compiler environment:');
  console.log('Current directory:', process.cwd());
  console.log('NODE_PATH environment variable:', process.env.NODE_PATH || 'not set');

  // Try to find the node.d.ts file
  const searchPaths = [
    './node_modules/@types/node',
    './packages/wdio-electron-service/node_modules/@types/node',
    '../node_modules/@types/node',
    '../../node_modules/@types/node',
  ];

  console.log('\nSearching for node.d.ts in:');
  searchPaths.forEach(searchPath => {
    const fullPath = path.resolve(searchPath);
    const indexPath = path.join(fullPath, 'index.d.ts');
    const exists = fs.existsSync(indexPath);
    console.log(`- ${fullPath}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    if (exists) {
      const packagePath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          console.log(`  - Version: ${packageJson.version || 'unknown'}`);
        } catch (e) {
          console.log(`  - Error reading package.json: ${e.message}`);
        }
      }
    }
  });

  // Try to simulate the typescript plugin initialization
  try {
    console.log('\nTrying to load rollup.config.ts:');
    // Check if the file exists but don't actually execute it
    const configPath = path.resolve('./packages/wdio-electron-service/rollup.config.ts');
    if (fs.existsSync(configPath)) {
      console.log(`Configuration file exists at: ${configPath}`);
      const configContent = fs.readFileSync(configPath, 'utf8');
      console.log('Configuration file content:');
      console.log('---');
      console.log(configContent);
      console.log('---');

      // Try to find typescript plugin configuration
      if (configContent.includes('@rollup/plugin-typescript')) {
        console.log('\nTypeScript plugin found in configuration.');

        // Extract typescript plugin configuration using a simple regex
        // This is not a full parser but should help identify basic issues
        const tsPluginRegex = /typescript\(\s*(\{[^}]*\})/s;
        const match = configContent.match(tsPluginRegex);

        if (match && match[1]) {
          console.log('TypeScript plugin configuration:', match[1]);

          // Look for tsconfig path
          const tsconfigRegex = /tsconfig\s*:\s*['"]([^'"]*)['"]/;
          const tsconfigMatch = match[1].match(tsconfigRegex);

          if (tsconfigMatch && tsconfigMatch[1]) {
            const tsconfigPath = path.resolve('./packages/wdio-electron-service', tsconfigMatch[1]);
            console.log(`\nReferenced tsconfig file: ${tsconfigPath}`);

            if (fs.existsSync(tsconfigPath)) {
              console.log('tsconfig exists');
              try {
                const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
                console.log('tsconfig content:', JSON.stringify(tsconfig, null, 2));

                // Check for types inclusion
                if (tsconfig.compilerOptions && tsconfig.compilerOptions.types) {
                  console.log('Types specified in tsconfig:', tsconfig.compilerOptions.types);
                  if (tsconfig.compilerOptions.types.includes('node')) {
                    console.log('node types are explicitly included');
                  } else {
                    console.log('node types are NOT explicitly included');
                  }
                } else {
                  console.log('No types array found in tsconfig');
                }
              } catch (e) {
                console.log(`Error parsing tsconfig: ${e.message}`);
              }
            } else {
              console.log('Referenced tsconfig does NOT exist');
            }
          } else {
            console.log('No tsconfig reference found in TypeScript plugin configuration');
          }
        } else {
          console.log('Could not extract TypeScript plugin configuration');
        }
      } else {
        console.log('No TypeScript plugin found in configuration');
      }
    } else {
      console.log(`Configuration file does NOT exist at: ${configPath}`);
    }
  } catch (e) {
    console.log(`Error analyzing rollup configuration: ${e.message}`);
    console.log(e.stack);
  }

  // Check TypeScript path resolution for node types
  console.log('\nTypeScript path resolution:');
  try {
    // Create a simple program to check module resolution
    const sourceFile = ts.createSourceFile(
      'test.ts',
      'import * as fs from "fs";',
      ts.ScriptTarget.Latest
    );

    const compilerOptions = {
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const program = ts.createProgram(['test.ts'], compilerOptions, host);
    program.emit();

    // Print diagnostic information
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      console.log('Diagnostics:');
      diagnostics.forEach(diagnostic => {
        console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      });
    } else {
      console.log('No diagnostics produced');
    }
  } catch (e) {
    console.log(`Error testing TypeScript resolution: ${e.message}`);
  }
EOF

  # Run the script to analyze rollup configuration
  echo "Running rollup debug analysis script..."
  node rollup-debug.js

  # Cleanup
  rm -f rollup-debug.js
else
  echo "Rollup configuration not found for the service package"
fi
