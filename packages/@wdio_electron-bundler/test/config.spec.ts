import { createEsmOutputConfig, createRollupConfig } from '../src/config';

describe('createRollupConfig', () => {
  it('should be set parameters', () => {
    const input = {
      index: 'index.js',
    } as const;
    const output = {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    } as const;
    const compilerOptions = {
      target: 'ESNext',
    } as const;
    const result = createRollupConfig(input, output, {
      compilerOptions,
      srcDir: '',
      rollupOptions: {},
      externalOptions: {},
    });
    expect(result.input).toStrictEqual(input);
    expect(result.output).toStrictEqual(output);
  });
});

describe('createEsmOutputConfig', () => {
  it('should be set parameters', () => {
    const params = {
      name: 'test',
      cjsDir: 'cjs',
      esmDir: 'esm',
    } as const;
    const result = createEsmOutputConfig(params);
    expect(result.format).toBe('esm');
    expect(result.dir).toBe(params.esmDir);
  });
});

describe('createCjsOutputConfig', () => {
  it('should be set parameters', () => {
    const params = {
      name: 'test',
      cjsDir: 'cjs',
      esmDir: 'esm',
    } as const;
    const result = createEsmOutputConfig(params);
    expect(result.format).toBe('esm');
    expect(result.dir).toBe(params.esmDir);
  });
});
