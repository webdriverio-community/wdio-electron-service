import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import type { PathValidationAttempt, PathValidationError, PathValidationResult } from '@wdio/electron-types';
import { createLogger } from './log.js';

const log = createLogger('utils');

function getValidationError(error: Error, path: string): PathValidationError {
  const nodeError = error as NodeJS.ErrnoException;

  if (nodeError.code === 'ENOENT') {
    return {
      type: 'FILE_NOT_FOUND',
      message: `ENOENT: no such file or directory, access '${path}'`,
      code: 'ENOENT',
    };
  }

  if (nodeError.code === 'EACCES') {
    return {
      type: 'PERMISSION_DENIED',
      message: `EACCES: permission denied, access '${path}'`,
      code: 'EACCES',
    };
  }

  if (nodeError.code === 'EISDIR') {
    return {
      type: 'IS_DIRECTORY',
      message: `EISDIR: illegal operation on a directory, access '${path}'`,
      code: 'EISDIR',
    };
  }

  // For other errors that might indicate the file exists but isn't executable
  const errorMessage = error.message || String(error);
  if (errorMessage.includes('not executable') || errorMessage.includes('permission')) {
    return {
      type: 'NOT_EXECUTABLE',
      message: `'${path}' is not executable`,
      details: errorMessage,
    };
  }

  // Generic access error
  return {
    type: 'ACCESS_ERROR',
    message: `Error accessing '${path}': ${errorMessage}`,
    details: errorMessage,
  };
}

export async function validateBinaryPaths(binaryPaths: string[]): Promise<PathValidationResult> {
  const attempts: PathValidationAttempt[] = [];
  let validPath: string | undefined;

  // Check each path and collect results
  for (const binaryPath of binaryPaths) {
    try {
      log.debug(`Checking binary path: ${binaryPath}...`);
      await fs.access(binaryPath, fsConstants.X_OK || 1); // X_OK is typically 1, fallback for tests
      log.debug(`'${binaryPath}' is executable.`);

      attempts.push({
        path: binaryPath,
        valid: true,
      });

      // Use the first valid path we find
      if (!validPath) {
        validPath = binaryPath;
      }
    } catch (error) {
      const validationError = getValidationError(error as Error, binaryPath);
      log.debug(`'${binaryPath}' is not executable.`, validationError.message);

      attempts.push({
        path: binaryPath,
        valid: false,
        error: validationError,
      });
    }
  }

  const success = validPath !== undefined;

  if (success && attempts.filter((a) => a.valid).length > 1) {
    const executablePaths = attempts.filter((a) => a.valid).map((a) => a.path);
    log.info(`Detected multiple app binaries, using the first one: \n${executablePaths.join(', \n')}`);
  }

  return {
    success,
    validPath,
    attempts,
  };
}

export async function selectExecutable(binaryPaths: string[]): Promise<string> {
  const result = await validateBinaryPaths(binaryPaths);

  if (!result.success || !result.validPath) {
    const pathsList = binaryPaths.join(', \n');
    throw new Error(`No executable binary found, checked: \n${pathsList}`);
  }

  return result.validPath;
}
