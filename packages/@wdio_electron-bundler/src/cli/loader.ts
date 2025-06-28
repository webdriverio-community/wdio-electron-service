import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BundlerConfig } from './types.js';
import { Logger } from './logger.js';

export interface ConfigSource {
  path: string;
  type: 'file' | 'package.json' | 'default';
  exists: boolean;
}

export class ConfigLoader {
  constructor(
    private cwd: string,
    private logger: Logger,
  ) {}

  /**
   * Load bundler configuration from various sources in order of precedence
   */
  async loadConfig(): Promise<BundlerConfig> {
    this.logger.section('🔍 Loading configuration...');

    const sources = this.getConfigSources();

    // Log the search order for extra verbose
    this.logger.extraDetail('Config resolution order:');
    sources.forEach((source, index) => {
      const status = source.exists ? '✅ found' : '⏭️  skipped';
      this.logger.extraDetail(`${index + 1}. ${source.path}... ${status}`, 2);
    });

    // Find first existing config
    const configSource = sources.find((source) => source.exists);

    if (!configSource) {
      this.logger.extraDetail('Using defaults for unspecified options... ✅ done');
      return this.getDefaultConfig();
    }

    this.logger.detail(`✅ Found ${configSource.path}`);

    try {
      const config = await this.loadConfigFromSource(configSource);
      return this.mergeWithDefaults(config);
    } catch (error) {
      throw new Error(`Failed to load config from ${configSource.path}: ${(error as Error).message}`);
    }
  }

  /**
   * Get all possible config sources in order of precedence
   */
  private getConfigSources(): ConfigSource[] {
    const configFiles = [
      'wdio-bundler.config.ts',
      'wdio-bundler.config.js',
      'wdio-bundler.config.mjs',
      'wdio-bundler.config.json',
    ];

    const sources: ConfigSource[] = [];

    // Check for explicit config files
    for (const file of configFiles) {
      const fullPath = resolve(this.cwd, file);
      sources.push({
        path: fullPath,
        type: 'file',
        exists: existsSync(fullPath),
      });
    }

    // Check package.json for bundler field
    const packageJsonPath = resolve(this.cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const content = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const hasBundlerField = !!(content as any)['wdio-bundler'];
        sources.push({
          path: `${packageJsonPath} (bundler field)`,
          type: 'package.json',
          exists: hasBundlerField,
        });
      } catch {
        // Ignore errors reading package.json
      }
    }

    return sources;
  }

  /**
   * Load configuration from a specific source
   */
  private async loadConfigFromSource(source: ConfigSource): Promise<Partial<BundlerConfig>> {
    if (source.type === 'package.json') {
      return await this.loadFromPackageJson();
    }

    const extension = source.path.split('.').pop();

    switch (extension) {
      case 'json':
        return this.loadFromJson(source.path);
      case 'js':
      case 'mjs':
      case 'ts':
        return this.loadFromJavaScript(source.path);
      default:
        throw new Error(`Unsupported config file format: ${extension}`);
    }
  }

  /**
   * Load configuration from package.json bundler field
   */
  private async loadFromPackageJson(): Promise<Partial<BundlerConfig>> {
    const packageJsonPath = resolve(this.cwd, 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    const bundlerConfig = packageJson['wdio-bundler'];

    if (!bundlerConfig) {
      throw new Error('No wdio-bundler configuration found in package.json');
    }

    if (typeof bundlerConfig !== 'object') {
      throw new Error('Invalid bundler configuration in package.json - must be an object');
    }

    return bundlerConfig;
  }

  /**
   * Load configuration from JSON file
   */
  private async loadFromJson(filePath: string): Promise<Partial<BundlerConfig>> {
    const content = await readFile(filePath, 'utf-8');

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in config file: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from JavaScript/TypeScript file
   */
  private async loadFromJavaScript(filePath: string): Promise<Partial<BundlerConfig>> {
    const isTypeScript = filePath.endsWith('.ts');

    try {
      if (isTypeScript) {
        // Use tsx to load TypeScript files
        return await this.loadFromTypeScript(filePath);
      }

      // Convert to file URL for dynamic import
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

      // Handle both default export and named export
      const config = module.default || module;

      if (typeof config !== 'object' || config === null) {
        throw new Error('Config file must export an object');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load JavaScript config: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from TypeScript file using tsx
   */
  private async loadFromTypeScript(filePath: string): Promise<Partial<BundlerConfig>> {
    const { spawn } = await import('node:child_process');

    try {
      // Get the bundler package path to add to module resolution
      const bundlerModulesPath = resolve(import.meta.url.replace('file://', ''), '..', '..', '..', 'node_modules');

      // Use tsx to run the TypeScript file and output JSON
      const tsxScript = `
import config from '${filePath}';
console.log(JSON.stringify(config, null, 2));
      `;

      const tempScript = `${filePath}.temp.mjs`;
      const { writeFileSync, unlinkSync } = await import('node:fs');

      writeFileSync(tempScript, tsxScript);

      try {
        const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          const child = spawn('npx', ['tsx', tempScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: this.cwd,
            env: {
              ...process.env,
              NODE_PATH: `${bundlerModulesPath}:${process.env.NODE_PATH || ''}`,
            },
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            if (code === 0) {
              resolve({ stdout, stderr });
            } else {
              reject(new Error(`tsx failed with code ${code}: ${stderr}`));
            }
          });

          child.on('error', reject);
        });

        unlinkSync(tempScript);

        const config = JSON.parse(result.stdout.trim());
        return config;
      } catch (error) {
        try {
          unlinkSync(tempScript);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to load TypeScript config: ${(error as Error).message}`);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): BundlerConfig {
    return {
      packageRoot: this.cwd,
      transformations: [],
      cjs: true, // Enable dual format (ESM + CJS) by default
    };
  }

  /**
   * Merge loaded config with defaults
   */
  private mergeWithDefaults(config: Partial<BundlerConfig>): BundlerConfig {
    const defaults = this.getDefaultConfig();

    return {
      ...defaults,
      ...config,
      packageRoot: config.packageRoot || this.cwd,
    };
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config: BundlerConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate transformations
    if (config.transformations) {
      for (const [index, transformation] of config.transformations.entries()) {
        if (!transformation.type) {
          errors.push(`Transformation ${index}: missing type`);
        }

        if (!['injectDependency', 'codeReplace'].includes(transformation.type)) {
          errors.push(`Transformation ${index}: invalid type '${transformation.type}'`);
        }

        if (!transformation.options) {
          errors.push(`Transformation ${index}: missing options`);
        }
      }
    }

    // Validate package root exists
    if (config.packageRoot && !existsSync(config.packageRoot)) {
      errors.push(`Package root does not exist: ${config.packageRoot}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
