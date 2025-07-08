import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'codeReplace',
      options: {
        id: 'src/log.ts',
        searchValue: "const l = logger('electron-service');",
        replaceValue: "const l = (logger.default || logger)('electron-service');",
      },
    },
  ],
};

export default config;
