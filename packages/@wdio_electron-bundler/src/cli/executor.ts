import { resolve } from 'node:path';
import { rollup } from 'rollup';
import type { RollupOptions, OutputOptions } from 'rollup';
import { Logger } from './logger.js';
import type { GeneratedRollupConfig } from './types.js';

export class RollupExecutor {
  constructor(private logger: Logger) {}

  /**
   * Execute rollup build using programmatic API with generated config
   */
  async executeBuild(
    generatedConfig: GeneratedRollupConfig,
    targetCwd: string,
    verbose: boolean = false,
  ): Promise<void> {
    this.logger.section('🔨 Executing rollup build...');
    this.logger.extraDetail(`Target directory: ${targetCwd}`);
    this.logger.extraDetail(`Configurations: ${generatedConfig.configs.length}`);

    try {
      // Build each configuration (ESM and CJS)
      for (const configSpec of generatedConfig.configs) {
        await this.buildSingleConfig(configSpec, targetCwd, verbose);
      }

      this.logger.detail('✅ Build completed successfully');
    } catch (error) {
      throw new Error(`Rollup build failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build a single rollup configuration (ESM or CJS)
   */
  private async buildSingleConfig(configSpec: any, targetCwd: string, verbose: boolean): Promise<void> {
    const { format } = configSpec;
    this.logger.detail(`📦 Building ${format.toUpperCase()} bundle...`);

    // Convert our config spec to actual rollup config
    const rollupConfig: RollupOptions = await this.createRollupConfig(configSpec, targetCwd);

    if (verbose) {
      this.logger.extraDetail(`Input: ${JSON.stringify(rollupConfig.input)}`);
      this.logger.extraDetail(`Output dir: ${(rollupConfig.output as OutputOptions).dir}`);
    }

    // Create bundle
    const bundle = await rollup(rollupConfig);

    try {
      // Write bundle
      await bundle.write(rollupConfig.output as OutputOptions);
      this.logger.extraDetail(`✅ ${format.toUpperCase()} bundle written`);
    } finally {
      // Always close bundle
      await bundle.close();
    }
  }

  /**
   * Convert our config spec to actual rollup configuration
   */
  private async createRollupConfig(configSpec: any, targetCwd: string): Promise<RollupOptions> {
    const typescriptPlugin = (await import('@rollup/plugin-typescript')).default;
    const { nodeExternals } = await import('rollup-plugin-node-externals');
    const { nodeResolve } = await import('@rollup/plugin-node-resolve');

    // Resolve input paths relative to target directory
    const input =
      typeof configSpec.input === 'string'
        ? resolve(targetCwd, configSpec.input)
        : Object.fromEntries(
            Object.entries(configSpec.input as Record<string, string>).map(([key, path]) => [
              key,
              resolve(targetCwd, path),
            ]),
          );

    // Build plugins array
    const plugins: any[] = [];

    // Add plugins based on our config spec
    for (const pluginSpec of configSpec.plugins) {
      if (pluginSpec.name === 'typescript') {
        // Import TypeScript compiler from our bundler's node_modules
        const typescript = await import('typescript');
        plugins.push(
          typescriptPlugin({
            compilerOptions: {
              target: 'ES2020',
              module: 'ESNext',
              moduleResolution: 'Node',
              allowSyntheticDefaultImports: true,
              esModuleInterop: true,
              skipLibCheck: true,
              noEmitOnError: false,
            },
            typescript: typescript.default, // Pass the TypeScript compiler explicitly
            include: ['**/*.ts', '**/*.tsx'],
            exclude: ['node_modules', '**/*.d.ts'],
          }),
        );
      } else if (pluginSpec.name === 'node-externals') {
        plugins.push(nodeExternals(pluginSpec.options || {}));
      } else if (pluginSpec.name === 'node-resolve') {
        plugins.push(nodeResolve());
      } else if (pluginSpec.name === 'warn-to-error') {
        plugins.push({
          name: 'warn-to-error',
          onLog(level: string, log: any) {
            if (level === 'warn') {
              this.error(log);
            }
          },
        });
      }
    }

    return {
      input,
      output: {
        format: configSpec.output.format,
        dir: resolve(targetCwd, configSpec.output.dir),
        sourcemap: configSpec.output.sourcemap,
        exports: 'named', // Always use named exports to avoid mixed export warnings
        dynamicImportInCjs: configSpec.output.dynamicImportInCjs,
        plugins:
          configSpec.output.plugins?.map((plugin: any) => ({
            name: plugin.name,
            generateBundle(this: any) {
              this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source:
                  plugin.name === 'emit-package-json'
                    ? configSpec.output.format === 'esm'
                      ? '{ "type": "module" }'
                      : '{ "type": "commonjs" }'
                    : '',
              });
            },
          })) || [],
      },
      plugins,
    };
  }
}
