import fs from 'node:fs';

import * as tar from 'tar';

tar
  .c(
    {
      // 'z' is alias for 'gzip' option
      z: true,
    },
    ['package'],
  )
  .pipe(fs.createWriteStream('wdio-electron-service.tgz'));
