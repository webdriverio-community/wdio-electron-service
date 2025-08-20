import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { Logger } from './logger.js';
import type {
  BundlerConfig,
  BundlerFormatConfig,
  ImportSpec,
  InlinePluginSpec,
  PackageInfo,
  PackageJson,
  PluginSpec,
  Transformation,
} from './types.js';

export class PackageAnalyzer {
  constructor(private logger: Logger) {}

  /**
   * Analyze package.json and extract build information
   */
  async analyzePackage(packageRoot: string): Promise<PackageInfo> {
    this.logger.extraVerbose('📦 Analyzing package...');

    const packageJsonPath = resolve(packageRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    const packageJson = await this.loadPackageJson(packageJsonPath);

    // Extract basic info
    const name = packageJson.name;
    if (!name) {
      throw new Error('Package name is required in package.json');
    }

    this.logger.extraDetail(`Package name: ${name}`);

    // Extract entry points from exports
    const input = this.extractEntryPoints(packageJson, packageRoot);
    this.logger.extraDetail(`Entry points: ${Object.keys(input).join(', ')}`);

    // Extract output directories
    const outDir = this.extractOutputDirectories(packageJson);
    this.logger.extraDetail(`Output directories: ESM=${outDir.esm}, CJS=${outDir.cjs}`);

    // Extract dependencies
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});

    this.logger.extraDetail(`Dependencies: ${dependencies.length} regular, ${devDependencies.length} dev`);

    return {
      name,
      version: packageJson.version || '0.0.0',
      type: packageJson.type || 'commonjs',
      input,
      outDir,
      dependencies,
      devDependencies,
      peerDependencies: Object.keys(packageJson.peerDependencies || {}),
    };
  }

  /**
   * Build all plugin specifications for a configuration
   */
  buildPluginSpecs(
    config: BundlerConfig,
    packageInfo: PackageInfo,
    packageRoot: string,
    format: 'esm' | 'cjs',
  ): PluginSpec[] {
    this.logger.extraVerbose(`🔌 Building plugin specs for ${format}...`);

    const plugins: PluginSpec[] = [];

    // Core plugins (always included)
    plugins.push(this.createTypescriptPlugin(packageInfo.outDir[format], packageRoot));
    plugins.push(this.createNodeExternalsPlugin(config, format));

    // Add nodeResolve only when needed (for dependency injection)
    const hasInjectDependency = config.transformations?.some((t) => t.type === 'injectDependency');
    if (hasInjectDependency) {
      plugins.push(this.createNodeResolvePlugin());
    }

    // Add transformation plugins
    if (config.transformations && config.transformations.length > 0) {
      const transformationPlugins = this.createTransformationPlugins(config.transformations);
      plugins.push(...transformationPlugins);
    }

    // Warning to error plugin (always last)
    plugins.push(this.createWarnToErrorPlugin());

    this.logger.extraDetail(`Built ${plugins.length} plugin specs`);
    return plugins;
  }

  /**
   * Collect all unique imports from plugin specs
   */
  collectImports(plugins: PluginSpec[]): ImportSpec[] {
    const importMap = new Map<string, ImportSpec>();

    for (const plugin of plugins) {
      if (plugin.inline || !plugin.import.from) {
        continue; // Skip inline plugins and plugins without imports
      }

      const key = plugin.import.from;
      if (importMap.has(key)) {
        // Merge imports from the same package
        const existing = importMap.get(key);
        if (!existing) {
          throw new Error(`Import map missing key: ${key}`);
        }
        if (plugin.import.default && !existing.default) {
          existing.default = plugin.import.default;
        }
        if (plugin.import.named) {
          existing.named = [...(existing.named || []), ...plugin.import.named];
          // Remove duplicates
          existing.named = [...new Set(existing.named)];
        }
      } else {
        importMap.set(key, { ...plugin.import });
      }
    }

    return Array.from(importMap.values());
  }

  /**
   * Create emit package.json inline plugin
   */
  createEmitPackageJsonPlugin(_packageName: string, format: 'esm' | 'cjs'): InlinePluginSpec {
    const packageContent = format === 'esm' ? '{ "type": "module" }' : '{ "type": "commonjs" }';

    return {
      name: 'emit-package-json',
      code: `{
  name: 'emit-package-json',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'package.json',
      source: ${JSON.stringify(packageContent)}
    });
  }
}`,
    };
  }

  /**
   * Load and parse package.json
   */
  private async loadPackageJson(packageJsonPath: string): Promise<PackageJson> {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch (error) {
      throw new Error(`Failed to load package.json: ${(error as Error).message}`);
    }
  }

  /**
   * Extract entry points from package.json exports field
   */
  private extractEntryPoints(packageJson: PackageJson, packageRoot: string): Record<string, string> {
    const exports = packageJson.exports;
    if (!exports) {
      throw new Error('package.json must have an "exports" field');
    }

    const srcDir = 'src'; // Standard convention
    const input: Record<string, string> = {};

    for (const [exportPath, _exportValue] of Object.entries(exports)) {
      // Convert export path to entry name
      const entryName = exportPath === '.' ? 'index' : basename(exportPath);

      // Find the corresponding source file
      const entryPath = this.findEntryFile(entryName, packageRoot, srcDir);
      if (entryPath) {
        input[entryName] = entryPath;
      }
    }

    if (Object.keys(input).length === 0) {
      throw new Error('No valid entry points found');
    }

    return input;
  }

  /**
   * Find the source file for an entry point
   */
  private findEntryFile(entryName: string, packageRoot: string, srcDir: string): string | null {
    const candidates = [
      `${srcDir}/${entryName}.ts`,
      `${srcDir}/${entryName}/index.ts`,
      `${srcDir}/${entryName}.mts`,
      `${srcDir}/${entryName}/index.mts`,
      `${srcDir}/${entryName}.cts`,
      `${srcDir}/${entryName}/index.cts`,
    ];

    for (const candidate of candidates) {
      const fullPath = resolve(packageRoot, candidate);
      if (existsSync(fullPath)) {
        return candidate;
      }
    }

    this.logger.warning(`Entry file not found for ${entryName}, tried: ${candidates.join(', ')}`);
    return null;
  }

  /**
   * Extract output directories from main/module fields
   */
  private extractOutputDirectories(packageJson: PackageJson): { esm: string; cjs: string } {
    const main = packageJson.main;
    const module = packageJson.module;

    if (!main || !module) {
      throw new Error('package.json must have both "main" and "module" fields');
    }

    return {
      cjs: dirname(main),
      esm: dirname(module),
    };
  }

  /**
   * Create TypeScript plugin specification
   */
  private createTypescriptPlugin(outDir: string, packageRoot: string): PluginSpec {
    // Check if tsconfig.json exists to determine if we should add declaration options
    const tsconfigPath = resolve(packageRoot, 'tsconfig.json');
    const hasTsconfig = existsSync(tsconfigPath);

    // Only add declaration options if tsconfig.json exists to avoid TypeScript plugin issues
    const compilerOptions = hasTsconfig
      ? `{
    outDir: '${outDir}',
    declaration: true,
    declarationMap: true,
  }`
      : `{
    outDir: '${outDir}',
  }`;

    const additionalOptions = hasTsconfig ? '' : ',\n  tsconfig: false';

    return {
      name: 'typescript',
      call: `typescript({
  compilerOptions: ${compilerOptions}${additionalOptions},
})`,
      import: {
        from: '@rollup/plugin-typescript',
        default: 'typescript',
      },
    };
  }

  /**
   * Serialize node externals config with RegExp support
   */
  private serializeNodeExternalsConfig(config: Record<string, unknown>): string {
    const serializeValue = (value: unknown): string => {
      if (value instanceof RegExp) {
        return value.toString();
      }
      if (Array.isArray(value)) {
        const items = value.map((item) => serializeValue(item)).join(', ');
        return `[${items}]`;
      }
      if (typeof value === 'string') {
        return JSON.stringify(value);
      }
      return JSON.stringify(value);
    };

    const entries = Object.entries(config).map(([key, value]) => {
      return `  ${JSON.stringify(key)}: ${serializeValue(value)}`;
    });

    return `{\n${entries.join(',\n')}\n}`;
  }

  /**
   * Create node externals plugin specification
   */
  private createNodeExternalsPlugin(config: BundlerConfig, format: 'esm' | 'cjs'): PluginSpec {
    const formatConfig = config[format];
    // Handle case where formatConfig might be boolean (for CJS)
    const packagesToBundle =
      (typeof formatConfig === 'object' ? (formatConfig as BundlerFormatConfig)?.bundle : undefined) || [];
    const packagesToExternalize =
      (typeof formatConfig === 'object' ? (formatConfig as BundlerFormatConfig)?.external : undefined) || [];

    let call = 'nodeExternals()';
    let options: Record<string, unknown> | undefined;

    if (packagesToBundle.length > 0 || packagesToExternalize.length > 0) {
      const nodeExternalsConfig: Record<string, unknown> = {};

      if (packagesToBundle.length > 0) {
        nodeExternalsConfig.exclude = packagesToBundle;
      }

      if (packagesToExternalize.length > 0) {
        // Convert string patterns to RegExp objects for node externals
        const includePatterns = packagesToExternalize.map((pattern) => {
          if (pattern.startsWith('^') && pattern.endsWith('$')) {
            return new RegExp(pattern);
          }
          return pattern;
        });
        nodeExternalsConfig.include = includePatterns;
      }

      // Custom serialization to handle RegExp objects
      const configStr = this.serializeNodeExternalsConfig(nodeExternalsConfig);
      call = `nodeExternals(${configStr})`;
      options = nodeExternalsConfig;
    }

    return {
      name: 'node-externals',
      call,
      options,
      import: {
        from: 'rollup-plugin-node-externals',
        default: 'nodeExternals',
      },
    };
  }

  /**
   * Create node resolve plugin specification
   */
  private createNodeResolvePlugin(): PluginSpec {
    return {
      name: 'node-resolve',
      call: 'nodeResolve()',
      import: {
        from: '@rollup/plugin-node-resolve',
        named: ['nodeResolve'],
      },
    };
  }

  /**
   * Create warn to error plugin specification (inline)
   */
  private createWarnToErrorPlugin(): PluginSpec {
    return {
      name: 'warn-to-error',
      call: `{
  name: 'warn-to-error',
  onLog(level, log) {
    if (level === 'warn') {
      this.error(log);
    }
  }
}`,
      import: {
        from: '', // No import needed for inline plugins
      },
      inline: true,
    };
  }

  /**
   * Create transformation plugins using bundler package
   */
  private createTransformationPlugins(transformations: Transformation[]): PluginSpec[] {
    const plugins: PluginSpec[] = [];

    // Group transformations by type
    const injectDependencies = transformations.filter((t) => t.type === 'injectDependency');
    const codeReplaces = transformations.filter((t) => t.type === 'codeReplace');

    // Add inject dependency plugin if needed
    if (injectDependencies.length > 0) {
      plugins.push(this.createInjectDependencyPlugin(injectDependencies));
    }

    // Add code replace plugin if needed
    if (codeReplaces.length > 0) {
      plugins.push(this.createCodeReplacePlugin(codeReplaces));
    }

    return plugins;
  }

  /**
   * Create inject dependency plugin using bundler package
   */
  private createInjectDependencyPlugin(transformations: Transformation[]): PluginSpec {
    const options = transformations.map((t) => t.options);
    const optionsStr = JSON.stringify(
      options,
      (_key, value) => {
        if (typeof value === 'function') {
          return `__FUNCTION__${value.toString()}__FUNCTION__`;
        }
        if (value instanceof RegExp) {
          return `__REGEXP__${value.toString()}__REGEXP__`;
        }
        return value;
      },
      2,
    )
      .replace(/"__FUNCTION__(.*?)__FUNCTION__"/g, '$1')
      .replace(/"__REGEXP__(.*?)__REGEXP__"/g, '$1');

    return {
      name: 'inject-dependency',
      call: `injectDependencyPlugin(${optionsStr})`,
      options, // Store the actual options for programmatic use
      import: {
        from: '@wdio/electron-bundler',
        named: ['injectDependencyPlugin'],
      },
    };
  }

  /**
   * Create code replace plugin using bundler package
   */
  private createCodeReplacePlugin(transformations: Transformation[]): PluginSpec {
    const options = transformations.map((t) => t.options);
    const optionsStr = JSON.stringify(
      options,
      (_key, value) => {
        if (value instanceof RegExp) {
          return `__REGEXP__${value.toString()}__REGEXP__`;
        }
        return value;
      },
      2,
    ).replace(/"__REGEXP__(.*?)__REGEXP__"/g, '$1');

    return {
      name: 'code-replace',
      call: `codeReplacePlugin(${optionsStr})`,
      options, // Store the actual options for programmatic use
      import: {
        from: '@wdio/electron-bundler',
        named: ['codeReplacePlugin'],
      },
    };
  }
}
