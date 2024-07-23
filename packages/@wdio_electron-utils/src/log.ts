import debug from 'debug';
import logger, { type Logger } from '@wdio/logger';

const d = debug('wdio-electron-service');
const l = logger('electron-service');

const log: Logger = {
  ...l,
  debug: (...args) => {
    d(args);
    l.debug(...args);
  },
};

export default log;
