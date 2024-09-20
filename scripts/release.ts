// Release script for the project
// Usage: tsx scripts/release.ts [option1] [option2] [...]
import shell from 'shelljs';

const options = process.argv.slice(2).join(' ');

shell.cp(['README.md', 'LICENSE'], 'packages/wdio-electron-service');
shell.cp(['LICENSE'], 'packages/@wdio_electron-utils');
shell.cp(['LICENSE'], 'packages/@wdio_electron-types');

shell.exec(`pnpm run release -- ${options}`);
shell.exec('sleep 5');
shell.exec(`release-it -VV ${options}`);
