import debug from 'debug';
import logger, { type Logger } from '@wdio/logger';

const d = debug('wdio-electron-service');
const l = logger('electron-service');

const log: Logger = {
  ...l,
  debug: (...args) => {
    if (typeof args.at(-1) === 'object') {
      if (args.length > 1) {
        d(args.slice(0, -1));
      }
      d('%O', args.at(-1));
    } else {
      d(args);
    }
    l.debug(...args);
  },
};

export default log;
