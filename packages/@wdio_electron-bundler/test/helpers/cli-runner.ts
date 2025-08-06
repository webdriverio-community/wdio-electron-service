import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the bundler CLI with given arguments
 */
export async function runBundlerCLI(args: string[], cwd?: string): Promise<CLIResult> {
  const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');

  // Check if CLI exists
  if (!existsSync(cliPath)) {
    throw new Error(`CLI not found at ${cliPath}. Run 'pnpm build' first.`);
  }

  // Check if working directory exists
  const workingDir = cwd || process.cwd();
  if (!existsSync(workingDir)) {
    // Return a failed result instead of throwing for non-existent directories
    return {
      stdout: '',
      stderr: 'Build failed: Working directory does not exist',
      exitCode: 1,
    };
  }

  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: workingDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0,
      });
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn CLI process: ${error.message}`));
    });
  });
}

/**
 * Run bundler build command on a fixture package
 */
export async function runBundlerBuild(packagePath: string, extraArgs: string[] = []): Promise<CLIResult> {
  return runBundlerCLI(['build', ...extraArgs], packagePath);
}
