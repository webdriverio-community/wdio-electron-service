// Run E2E tests
import url from 'node:url';
import path from 'node:path';

import shell from 'shelljs';

// assign dirname
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// navigate to e2e directory
shell.cd(path.join(__dirname, '..', 'packages', 'e2e'));

// xvfb-run is required to run the tests on Linux
if (process.platform === 'linux') {
  shell.exec('xvfb-run pnpm exec:main && xvfb-run pnpm exec:multiremote && xvfb-run pnpm exec:standalone');
} else {
  shell.exec('pnpm exec:main && pnpm exec:multiremote && pnpm exec:standalone');
}
