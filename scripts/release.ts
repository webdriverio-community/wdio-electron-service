// Release script for the project
// Usage: tsx scripts/release.ts [option1] [option2] [...]
import shell from 'shelljs';

const options = process.argv.slice(2).join(' ');

shell.exec(`pnpm run release -- ${options}`);
shell.exec(`release-it -VV ${options}`);
