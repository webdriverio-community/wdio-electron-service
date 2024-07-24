import fs from 'node:fs';
import url from 'node:url';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import * as rollup from 'rollup';

const templatePath = process.argv[2];
const outputPath = process.argv[3];
const packageName = process.argv[4];

async function bundlePackage(packageName: string): Promise<string> {
  // Resolve the entry point of the npm package
  const entryPoint = url.fileURLToPath(import.meta.resolve(packageName));

  // Create a Rollup bundle
  const bundle = await rollup.rollup({
    input: entryPoint,
    plugins: [nodeResolve()],
  });

  // Generate the bundled code
  const { output } = await bundle.generate({
    format: 'esm',
    name: packageName,
  });

  // Extract the bundled code as a string
  const bundledCode = output[0].code;

  // Return the bundled code
  return bundledCode;
}

async function injectDependency(templatePath: string, outputPath: string, packageName: string): Promise<void> {
  // try {
  // Read the template file
  const templateContent = await fs.promises.readFile(templatePath, 'utf-8');

  // Bundle the contents of the npm package
  const bundledContents = await bundlePackage(packageName);

  // const bundledContents = await fs.promises.readFile(import.meta.resolve(packageName), 'utf-8');
  // const bundledContents = await fs.promises.readFile(
  //   '/Users/sam/Workspace/wdio-electron-service/node_modules/.pnpm/@vitest+spy@2.0.4/node_modules/@vitest/spy/dist/index.js',
  //   'utf-8',
  // );

  // Prepare the bundled contents for injection
  const injectedContents = bundledContents.replace('export', 'const spy =');

  // Replace instances of the dynamic import in the template with the bundled contents
  const renderedContent = templateContent.replace("const spy = await import('@vitest/spy');", injectedContents);

  // Write the rendered content to a new file
  await fs.promises.writeFile(outputPath, renderedContent, 'utf-8');

  console.log(`Successfully bundled and injected ${packageName} into ${outputPath}`);
  // } catch (error) {
  //   console.error('Dependency injection failed:', error);
  // }
}

await injectDependency(templatePath, outputPath, packageName);
