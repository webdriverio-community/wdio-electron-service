// Publish script for the project - publishes the packages to the npm registry
// Usage: tsx scripts/publish.ts [option1] [option2] [...]
import shell from 'shelljs';

const options = process.argv.slice(2);

shell.cp(['README.md', 'LICENSE'], 'packages/wdio-electron-service');
shell.cp(['LICENSE'], 'packages/@wdio_electron-utils');
shell.cp(['LICENSE'], 'packages/@wdio_electron-types');

const publishCommand = `pnpm publish -r ${options.join(' ')}`;

console.log(`Publishing wdio-electron-service...`, publishCommand);

// shell.exec(publishCommand);
