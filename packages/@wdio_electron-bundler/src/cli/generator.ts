import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type {
  BundlerConfig,
  PackageInfo,
  OutputSpec,
  ConfigSpec,
  GeneratedRollupConfig,
  ImportSpec,
  InlinePluginSpec,
} from './types.js';
import { Logger } from './logger.js';
import { PackageAnalyzer } from './analyzer.js';

export class ConfigGenerator {
  private packageAnalyzer: PackageAnalyzer;

  constructor(private logger: Logger) {
    this.packageAnalyzer = new PackageAnalyzer(logger);
  }

  /**
   * Generate rollup configuration from bundler config
   */
  async generateConfig(config: BundlerConfig, packagePath: string): Promise<GeneratedRollupConfig> {
    this.logger.verbose('📦 Generating rollup configuration...');

    // Analyze package
    const packageInfo = await this.packageAnalyzer.analyzePackage(packagePath);
    this.logger.extraDetail(`Package: ${packageInfo.name}@${packageInfo.version}`);

    // Generate ESM config
    const esmConfig = this.generateFormatConfig(config, packageInfo, 'esm');

    // Generate CJS config (if enabled)
    const cjsConfig = config.cjs ? this.generateFormatConfig(config, packageInfo, 'cjs') : null;

    // Collect all imports
    const allPlugins = [...esmConfig.plugins, ...(cjsConfig?.plugins || [])];
    const imports = this.packageAnalyzer.collectImports(allPlugins);

    const result: GeneratedRollupConfig = {
      imports,
      configs: cjsConfig ? [esmConfig, cjsConfig] : [esmConfig],
      packageInfo,
    };

    this.logger.verbose(`✅ Generated ${result.configs.length} configuration(s)`);
    return result;
  }

  /**
   * Generate configuration for a specific format
   */
  private generateFormatConfig(config: BundlerConfig, packageInfo: PackageInfo, format: 'esm' | 'cjs'): ConfigSpec {
    this.logger.extraVerbose(`🔧 Generating ${format.toUpperCase()} config...`);

    // Build plugins for this format
    const plugins = this.packageAnalyzer.buildPluginSpecs(config, packageInfo, format);

    // Build output configuration
    const output = this.buildOutput(packageInfo, format);

    return {
      input: packageInfo.input,
      output,
      plugins,
      format,
    };
  }

  /**
   * Build output configuration for a format
   */
  private buildOutput(packageInfo: PackageInfo, format: 'esm' | 'cjs'): OutputSpec {
    // Create emit package.json plugin
    const emitPlugin = this.packageAnalyzer.createEmitPackageJsonPlugin(packageInfo.name, format);

    return {
      format,
      dir: packageInfo.outDir[format],
      sourcemap: true,
      plugins: [emitPlugin],
    };
  }

  /**
   * Write rollup configuration to file
   */
  async writeConfig(config: GeneratedRollupConfig, outputPath: string, dryRun: boolean = false): Promise<string> {
    this.logger.verbose(`✍️  Writing rollup config to ${outputPath}...`);

    const configContent = this.generateConfigContent(config);

    // Format the content with prettier first
    const formattedContent = await this.formatContentWithPrettier(configContent);

    if (dryRun) {
      this.logger.section('📄 Generated config (dry run):');
      // Always show the config content in dry-run, regardless of verbosity
      console.log('\n```javascript');
      console.log(formattedContent);
      console.log('```\n');
      return formattedContent;
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Write formatted config file
    await fs.writeFile(outputPath, formattedContent, 'utf-8');

    this.logger.verbose(`✅ Config written to ${outputPath}`);
    return formattedContent;
  }

  /**
   * Format content string with prettier in memory
   */
  private async formatContentWithPrettier(content: string): Promise<string> {
    try {
      this.logger.extraVerbose('🎨 Formatting with prettier...');

      return await new Promise<string>((resolve, _reject) => {
        const child = spawn('pnpx', ['prettier', '--parser', 'babel', '--stdin-filepath', 'rollup.config.js'], {
          stdio: 'pipe',
          shell: true,
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
            this.logger.extraDetail('✅ Formatted with prettier');
            resolve(stdout);
          } else {
            this.logger.warning('⚠️ Prettier formatting failed, using unformatted content');
            this.logger.extraDetail(`Prettier error: ${stderr}`);
            resolve(content); // Return original content if formatting fails
          }
        });

        child.on('error', (error) => {
          this.logger.warning('⚠️ Could not run prettier, using unformatted content');
          this.logger.extraDetail(`Error: ${error.message}`);
          resolve(content); // Return original content if prettier not available
        });

        // Send content to prettier stdin
        child.stdin?.write(content);
        child.stdin?.end();
      });
    } catch (error) {
      this.logger.warning('⚠️ Formatting failed, using unformatted content');
      this.logger.extraDetail(`Error: ${(error as Error).message}`);
      return content; // Return original content on any error
    }
  }

  /**
   * Generate the complete configuration file content
   */
  private generateConfigContent(config: GeneratedRollupConfig): string {
    const lines: string[] = [];

    // Add enhanced file header
    lines.push(...this.generateHeader(config));

    // Add imports
    if (config.imports.length > 0) {
      lines.push(...this.generateImports(config.imports));
      lines.push('');
    }

    // Add configurations
    lines.push(...this.generateConfigurations(config.configs));

    // Add export
    if (config.configs.length === 1) {
      lines.push('');
      lines.push('export default config;');
    } else {
      lines.push('');
      lines.push('export default [esmConfig, cjsConfig];');
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Generate enhanced header comment with metadata
   */
  private generateHeader(config: GeneratedRollupConfig): string[] {
    const now = new Date();
    const timestamp = now.toISOString();

    return [
      '// rollup.config.js (generated by @wdio/electron-bundler)',
      `// Package: ${config.packageInfo.name}@${config.packageInfo.version}`,
      `// Generated: ${timestamp}`,
      `// Configurations: ${config.configs.length} (${config.configs.map((c) => c.format.toUpperCase()).join(', ')})`,
      '',
      '// This file was auto-generated. Modifications will be overwritten.',
      '// To make changes, edit your wdio-bundler configuration instead.',
      '',
    ];
  }

  /**
   * Generate import statements
   */
  private generateImports(imports: ImportSpec[]): string[] {
    return imports
      .filter((imp) => imp.from) // Skip empty imports
      .map((imp) => {
        const parts: string[] = [];

        if (imp.default) {
          parts.push(imp.default);
        }

        if (imp.named && imp.named.length > 0) {
          const namedImports = `{ ${imp.named.join(', ')} }`;
          parts.push(namedImports);
        }

        return `import ${parts.join(', ')} from '${imp.from}';`;
      });
  }

  /**
   * Generate configuration objects
   */
  private generateConfigurations(configs: ConfigSpec[]): string[] {
    const lines: string[] = [];

    configs.forEach((config, index) => {
      const configName = configs.length === 1 ? 'config' : config.format === 'esm' ? 'esmConfig' : 'cjsConfig';

      lines.push(`const ${configName} = {`);
      lines.push(`  input: ${this.formatInput(config.input)},`);
      lines.push(`  output: ${this.formatOutput(config.output)},`);
      lines.push(`  plugins: [`);

      // Add plugins
      config.plugins.forEach((plugin, pluginIndex) => {
        const isLast = pluginIndex === config.plugins.length - 1;
        if (plugin.inline) {
          lines.push(`    ${plugin.call}${isLast ? '' : ','}`);
        } else {
          lines.push(`    ${plugin.call}${isLast ? '' : ','}`);
        }
      });

      lines.push('  ],');
      lines.push('};');

      if (index < configs.length - 1) {
        lines.push('');
      }
    });

    return lines;
  }

  /**
   * Format input object
   */
  private formatInput(input: Record<string, string>): string {
    const entries = Object.entries(input);
    if (entries.length === 1 && entries[0][0] === 'index') {
      return `'${entries[0][1]}'`;
    }

    const formatted = entries.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');

    return `{\n${formatted}\n}`;
  }

  /**
   * Format output configuration
   */
  private formatOutput(output: any): string {
    const lines: string[] = [];
    lines.push('{');
    lines.push(`  format: '${output.format}',`);
    lines.push(`  dir: '${output.dir}',`);
    lines.push(`  sourcemap: ${output.sourcemap},`);

    if (output.format === 'cjs') {
      lines.push(`  exports: 'named',`);
      lines.push(`  dynamicImportInCjs: false,`);
    }

    // Add output plugins if any
    if (output.plugins && output.plugins.length > 0) {
      lines.push('  plugins: [');
      output.plugins.forEach((plugin: InlinePluginSpec, index: number) => {
        const isLast = index === output.plugins.length - 1;
        lines.push(`    ${plugin.code}${isLast ? '' : ','}`);
      });
      lines.push('  ],');
    }

    lines.push('}');
    return lines.join('\n  ');
  }
}
