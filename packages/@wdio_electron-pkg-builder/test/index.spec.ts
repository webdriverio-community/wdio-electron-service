/* eslint-disable @typescript-eslint/ban-ts-comment */
import { dirname } from 'node:path';

import { createCjsRollupOptions, createEsmRollupOptions, createRollupConfig } from '../src/index';
import { getFixturePackagePath } from './utils';
import { rollup } from 'rollup';

describe('createRollupConfig', () => {
  it('should return 2 configuration objects', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = createRollupConfig({ rootDir: cwd });

    expect(result.length).toBe(2);
    // @ts-ignore
    expect(result[0].output!.format).toBe('esm');
    // @ts-ignore
    expect(result[1].output!.format).toBe('cjs');
  });

  it('should fail to load package.json that is not existed', () => {
    expect(() => createRollupConfig({ rootDir: '/path/not/existed' })).toThrowError(`Failed to load the package.json`);
  });

  it('should fail when warning occurred', async () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const config = createRollupConfig({
      rootDir: cwd,
      compilerOptions: {
        sourceMap: true, // When Enable source maps, cose warnings at rollup-plugin-typescript
      },
    });

    const bundle = await rollup(config[0]);
    await expect(() => bundle.generate({})).rejects.toThrowError();
  });
});

describe('createEsmOutputConfig', () => {
  it('should return configuration for ESM', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = createEsmRollupOptions({ rootDir: cwd });

    // @ts-ignore
    expect(result.output!.format).toBe('esm');
  });
});

describe('createCjsOutputConfig', () => {
  it('should return configuration for ESM', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = createCjsRollupOptions({ rootDir: cwd });

    // @ts-ignore
    expect(result.output!.format).toBe('cjs');
  });
});
