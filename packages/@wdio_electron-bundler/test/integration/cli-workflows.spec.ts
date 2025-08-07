import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runBundlerBuild } from '../helpers/cli-runner.js';
import { getBundlerFixturePath } from '../helpers/fixture-utils.js';

describe('CLI Workflows Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bundler-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('build command', () => {
    it('should build CJS package with no config (defaults)', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'no-config');

      const result = await runBundlerBuild(fixturePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Build completed successfully');
    }, 30000);

    it('should build ESM package with TypeScript config', async () => {
      const fixturePath = getBundlerFixturePath('esm', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Build completed successfully');
    }, 30000);

    it('should handle dry run mode', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--dry-run']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
      expect(result.stdout).not.toContain('Build completed');
    });

    it('should export config and build', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--export-config']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration exported');
      expect(result.stdout).toContain('Build completed successfully');

      // Check that config file was created
      const configPath = path.join(fixturePath, 'rollup.config.js');
      await expect(fs.access(configPath)).resolves.toBeUndefined();
    }, 30000);

    it('should support verbose output', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'no-config');

      const result = await runBundlerBuild(fixturePath, ['--verbose']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Loading configuration');
    });

    it('should support extra verbose output', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'no-config');

      const result = await runBundlerBuild(fixturePath, ['--vv']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Config resolution order');
    });

    it('should generate CommonJS syntax config for CJS packages', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--dry-run']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('const typescript = require');
      expect(result.stdout).toContain('const nodeExternals = require');
      expect(result.stdout).toContain('module.exports = [esmConfig, cjsConfig]');
      expect(result.stdout).not.toContain('import typescript from');
      expect(result.stdout).not.toContain('export default');
    });

    it('should generate ESM syntax config for ESM packages', async () => {
      const fixturePath = getBundlerFixturePath('esm', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--dry-run']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('import typescript from');
      expect(result.stdout).toContain('import nodeExternals from');
      expect(result.stdout).toContain('export default [esmConfig, cjsConfig]');
      expect(result.stdout).not.toContain('const typescript = require');
      expect(result.stdout).not.toContain('module.exports');
    });

    it('should export CJS config file with proper syntax for CJS packages', async () => {
      const fixturePath = getBundlerFixturePath('cjs', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--export-config']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration exported');

      // Read the exported config file
      const configPath = path.join(fixturePath, 'rollup.config.js');
      const configContent = await fs.readFile(configPath, 'utf-8');

      expect(configContent).toContain('const typescript = require');
      expect(configContent).toContain('module.exports = [esmConfig, cjsConfig]');
      expect(configContent).not.toContain('import typescript from');
      expect(configContent).not.toContain('export default');
    }, 30000);

    it('should export ESM config file with proper syntax for ESM packages', async () => {
      const fixturePath = getBundlerFixturePath('esm', 'simple-ts-config');

      const result = await runBundlerBuild(fixturePath, ['--export-config']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration exported');

      // Read the exported config file
      const configPath = path.join(fixturePath, 'rollup.config.js');
      const configContent = await fs.readFile(configPath, 'utf-8');

      expect(configContent).toContain('import typescript from');
      expect(configContent).toContain('export default [esmConfig, cjsConfig]');
      expect(configContent).not.toContain('const typescript = require');
      expect(configContent).not.toContain('module.exports');
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle invalid package directory', async () => {
      const result = await runBundlerBuild('/non/existent/path');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Build failed');
    });
  });
});
