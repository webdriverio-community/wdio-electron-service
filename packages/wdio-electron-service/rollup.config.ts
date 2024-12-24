import { RollupOptionCreator } from '@wdio/electron-bundler';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const creator = new RollupOptionCreator({
  options: {
    cjs: {
      externalOptions: {
        exclude: 'fast-copy',
      },
    },
  },
});

const cjsConfig = creator.cjsRollupOptions;

if (typeof cjsConfig.plugins !== 'undefined' && Array.isArray(cjsConfig.plugins)) {
  cjsConfig.plugins.push(nodeResolve());
}

export default creator.getConfigs();
