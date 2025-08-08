import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'codeReplace',
      options: {
        id: 'src/log.ts',
        searchValue: 'const areaLogger = logger(`electron-service$' + '{areaSuffix}`);',
        replaceValue: 'const areaLogger = (logger.default || logger)(`electron-service$' + '{areaSuffix}`);',
      },
    },
  ],
};

export default config;
