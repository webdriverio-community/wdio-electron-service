import logger, { Logger } from '@wdio/logger';

import debug from 'debug';

const d = debug('wdio-electron-service');
const l = logger('electron-service');

export const log: Logger = {
  ...l,
  debug: (...args) => {
    d(args);
    l.debug(...args);
  },
};
