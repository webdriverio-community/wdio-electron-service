/* eslint-disable @typescript-eslint/ban-ts-comment */
import { dirname } from 'node:path';

import { RollupOptionCreator } from '../src/index';
import { getFixturePackagePath } from './utils';
import { rollup } from 'rollup';

describe('RollupOptionCreator', () => {
  it('should return 2 configuration objects', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = new RollupOptionCreator({ rootDir: cwd });

    expect(result.getConfigs().length).toBe(2);
    // @ts-ignore
    expect(result.esmRollupOptions.output!.format).toBe('esm');
    // @ts-ignore
    expect(result.cjsRollupOptions.output!.format).toBe('cjs');
  });

  it('should fail to load package.json that is not existed', () => {
    expect(() => new RollupOptionCreator({ rootDir: '/path/not/existed' })).toThrowError(
      `Failed to load the package.json`,
    );
  });

  it('should fail when warning occurred', async () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const config = new RollupOptionCreator({
      rootDir: cwd,
      options: {
        esm: {
          typescriptOptions: {
            compilerOptions: {
              sourceMap: true, // When Enable source maps, cose warnings at rollup-plugin-typescript
            },
          },
        },
      },
    });

    const bundle = await rollup(config.esmRollupOptions);
    await expect(() => bundle.generate({})).rejects.toThrowError();
  });
});
