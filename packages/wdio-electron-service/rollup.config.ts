import { createEsmRollupOptions, createCjsRollupOptions } from '@wdio/electron-bundler';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const esmConfig = createEsmRollupOptions();

const cjsConfig = createCjsRollupOptions({
  externalOptions: {
    exclude: 'fast-copy',
  },
});

if (typeof cjsConfig.plugins !== 'undefined' && Array.isArray(cjsConfig.plugins)) {
  cjsConfig.plugins.push(nodeResolve());
}

export default [esmConfig, cjsConfig];
