// Publish script for the project - publishes the packages to the npm registry
// Usage: pnpx tsx scripts/publish.ts [option1] [option2] [...]
import shell from 'shelljs';

const options = process.argv.slice(2);

shell.cp(['README.md', 'LICENSE'], 'packages/wdio-electron-service');
shell.cp(['LICENSE'], 'packages/@wdio_electron-utils');
shell.cp(['LICENSE'], 'packages/@wdio_electron-types');
shell.cp(['LICENSE'], 'packages/@wdio_electron-cdp-bridge');

// --no-git-checks is used to skip the git checks - due to getting erroneous ERR_PNPM_GIT_UNCLEAN errors
const publishCommand = `pnpm publish -r --access public --no-git-checks ${options.join(' ')}`;

console.log(`Publishing wdio-electron-service...`, publishCommand);

shell.exec(publishCommand);
