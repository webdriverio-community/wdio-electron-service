import { nodeExternals, typescript, readPackageJson } from './src/index.js';
import type { RollupOptions, Plugin, LogLevel, RollupLog } from 'rollup';

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
