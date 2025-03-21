/**
 * Utility functions for managing Electron processes
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Kill all running Electron processes
 */
export async function killElectronProcesses(): Promise<void> {
  try {
    console.log('Attempting to kill any running Electron processes...');

    if (process.platform === 'win32') {
      // Windows command
      await execPromise('taskkill /F /IM electron.exe /T 2>nul || exit /b 0');
      console.log('Killed Electron processes on Windows');
    } else if (process.platform === 'darwin') {
      // macOS command
      await execPromise("pkill -f 'Electron' || true");
      console.log('Killed Electron processes on macOS');
    } else {
      // Linux command
      await execPromise("pkill -f 'electron' || true");
      console.log('Killed Electron processes on Linux');
    }
  } catch (error) {
    // Ignore errors if no processes were found to kill
    console.log('Note: No Electron processes found to kill or error occurred');
    console.log(error instanceof Error ? error.message : String(error));
  }
}
