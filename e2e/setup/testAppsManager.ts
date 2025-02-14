import { mkdtemp, readFile, writeFile, rm, rename } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class TestAppsManager {
  private static instance: TestAppsManager;
  private tmpDir: string | null = null;

  private constructor() {}

  static getInstance(): TestAppsManager {
    if (!TestAppsManager.instance) {
      TestAppsManager.instance = new TestAppsManager();
    }
    return TestAppsManager.instance;
  }

  async prepareTestApps(): Promise<string> {
    if (this.tmpDir) {
      return this.tmpDir;
    }

    // 1. Package the service
    const { stdout: packOutput } = await execAsync('pnpm pack', { cwd: process.cwd() });
    const packageFileName = packOutput.trim();

    // 2. Create temp directory and copy apps
    this.tmpDir = await mkdtemp(join(tmpdir(), 'wdio-electron-test-'));
    await execAsync(`cp -r ${join(process.cwd(), 'apps')} ${this.tmpDir}`);

    // Move packed service
    await rename(join(process.cwd(), packageFileName), join(this.tmpDir, 'apps', packageFileName));

    // 3. Update each app's package.json
    const appDirs = ['builder-cjs', 'builder-esm', 'forge-cjs', 'forge-esm', 'no-binary-cjs', 'no-binary-esm'];

    for (const appDir of appDirs) {
      const appPath = join(this.tmpDir, 'apps', appDir);
      const packageJsonPath = join(appPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

      packageJson.dependencies['wdio-electron-service'] = `../${packageFileName}`;

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    // 4. Install dependencies
    await execAsync('pnpm install', { cwd: join(this.tmpDir, 'apps') });

    return this.tmpDir;
  }

  async cleanup(): Promise<void> {
    if (this.tmpDir) {
      try {
        await rm(this.tmpDir, { recursive: true, force: true });
        this.tmpDir = null;
      } catch (error) {
        console.error('Failed to cleanup temp directory:', error);
      }
    }
  }

  getTmpDir(): string | null {
    return this.tmpDir;
  }
}

export const testAppsManager = TestAppsManager.getInstance();
