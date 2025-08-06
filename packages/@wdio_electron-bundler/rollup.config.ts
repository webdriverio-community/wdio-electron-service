import type { LogLevel, Plugin, RollupLog, RollupOptions } from 'rollup';
import { nodeExternals, readPackageJson, typescript } from './src/index.js';

const pkgInfo = readPackageJson();

// Add CLI as a separate entry point
const input = {
  ...pkgInfo.input,
  cli: 'src/cli.ts',
};

const warnToErrorPlugin = (): Plugin => ({
  name: 'warn-to-error',
  onLog(level: LogLevel, log: RollupLog) {
    if (level === 'warn') {
      this.error(log);
    }
  },
});

const config: RollupOptions = {
  input,
  output: {
    format: 'esm',
    dir: './dist',
    sourcemap: true,
  },
  plugins: [
    typescript({
      compilerOptions: {
        outDir: './dist',
      },
    }),
    nodeExternals(),
    warnToErrorPlugin(),
  ],
  strictDeprecations: true,
};

export default config;
