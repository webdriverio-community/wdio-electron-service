import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { PackageInfo, BundlerConfig, PluginSpec, ImportSpec, InlinePluginSpec, Transformation } from './types.js';
import { Logger } from './logger.js';

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
  buildPluginSpecs(config: BundlerConfig, packageInfo: PackageInfo, format: 'esm' | 'cjs'): PluginSpec[] {
    this.logger.extraVerbose(`🔌 Building plugin specs for ${format}...`);

    const plugins: PluginSpec[] = [];

    // Core plugins (always included)
    plugins.push(this.createTypescriptPlugin(packageInfo.outDir[format]));
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
        const existing = importMap.get(key)!;
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
  createEmitPackageJsonPlugin(packageName: string, format: 'esm' | 'cjs'): InlinePluginSpec {
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
  private async loadPackageJson(packageJsonPath: string): Promise<any> {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load package.json: ${(error as Error).message}`);
    }
  }

  /**
   * Extract entry points from package.json exports field
   */
  private extractEntryPoints(packageJson: any, packageRoot: string): Record<string, string> {
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
  private extractOutputDirectories(packageJson: any): { esm: string; cjs: string } {
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
  private createTypescriptPlugin(outDir: string): PluginSpec {
    return {
      name: 'typescript',
      call: `typescript({
  compilerOptions: {
    outDir: '${outDir}',
  },
})`,
      import: {
        from: '@rollup/plugin-typescript',
        default: 'typescript',
      },
    };
  }

  /**
   * Create node externals plugin specification
   */
  private createNodeExternalsPlugin(config: BundlerConfig, format: 'esm' | 'cjs'): PluginSpec {
    // Check if there are any specific externals config for this format
    const formatConfig = config[format];
    const nodeExternalsConfig = (formatConfig as any)?.nodeExternals;

    let call = 'nodeExternals()';
    let options: Record<string, any> | undefined = undefined;

    if (nodeExternalsConfig && Object.keys(nodeExternalsConfig).length > 0) {
      const configStr = JSON.stringify(nodeExternalsConfig, null, 2)
        .split('\n')
        .map((line, index) => (index === 0 ? line : '  ' + line))
        .join('\n');
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
      (key, value) => {
        if (typeof value === 'function') {
          return value.toString();
        }
        if (value instanceof RegExp) {
          return value.toString();
        }
        return value;
      },
      2,
    );

    return {
      name: 'inject-dependency',
      call: `injectDependencyPlugin(${optionsStr})`,
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
      (key, value) => {
        if (value instanceof RegExp) {
          return value.toString();
        }
        return value;
      },
      2,
    );

    return {
      name: 'code-replace',
      call: `codeReplacePlugin(${optionsStr})`,
      import: {
        from: '@wdio/electron-bundler',
        named: ['codeReplacePlugin'],
      },
    };
  }
}
