import { execSync } from 'node:child_process';

/**
 * Kill all running Electron processes
 */
export async function killElectronProcesses(): Promise<void> {
  console.log('🔪 Killing any remaining Electron processes...');
  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill with /F to force kill
      execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
    } else {
      // On Unix-like systems, try multiple approaches to ensure all processes are killed
      try {
        // First try pkill with -f to match command line
        execSync('pkill -f electron', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors, as they likely mean no processes were found
      }

      try {
        // Also try to kill by process name
        execSync('pkill -9 -f Electron', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors
      }

      try {
        // Also try to kill any node processes related to electron
        execSync('pkill -f "node.*electron"', { stdio: 'ignore' });
      } catch (_) {
        // Ignore errors
      }

      // On macOS, also try to kill by app bundle
      if (process.platform === 'darwin') {
        try {
          execSync('pkill -f "example-.*\\.app"', { stdio: 'ignore' });
        } catch (_) {
          // Ignore errors
        }
      }
    }
    console.log('✅ Electron processes killed');
  } catch (_error) {
    // Ignore errors as they likely mean no processes were found
    console.log('ℹ️ No Electron processes found to kill');
  }
}
