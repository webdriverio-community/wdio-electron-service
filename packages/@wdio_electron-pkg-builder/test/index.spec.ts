import { dirname } from 'node:path';

import { createRollupConfig } from '../src/index';
import { getFixturePackagePath } from './utils';
import { rollup } from 'rollup';

describe('getBuildConfigs', () => {
  it('should return 2 configuration objects', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = createRollupConfig({ rootDir: cwd });

    expect(result.length).toBe(2);
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
