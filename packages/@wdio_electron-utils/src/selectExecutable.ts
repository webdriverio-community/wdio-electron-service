import fs from 'node:fs/promises';

import log from './log.js';

export async function selectExecutable(binaryPaths: string[]): Promise<string> {
  // for each path, check if it exists and is executable
  const binaryPathsAccessResults = await Promise.all(
    binaryPaths.map(async (binaryPath) => {
      try {
        log.debug(`Checking binary path: ${binaryPath}...`);
        await fs.access(binaryPath, fs.constants.X_OK);
        log.debug(`'${binaryPath}' is executable.`);
        return true;
      } catch (e) {
        log.debug(`'${binaryPath}' is not executable.`, (e as Error).message);
        return false;
      }
    }),
  );

  // get the list of executable paths
  const executableBinaryPaths = binaryPaths.filter((_binaryPath, index) => binaryPathsAccessResults[index]);

  // no executable binary case
  if (executableBinaryPaths.length === 0) {
    throw new Error(`No executable binary found, checked: \n${binaryPaths.join(', \n')}`);
  }

  // multiple executable binaries case
  if (executableBinaryPaths.length > 1) {
    log.info(`Detected multiple app binaries, using the first one: \n${executableBinaryPaths.join(', \n')}`);
  }

  return executableBinaryPaths[0];
}
