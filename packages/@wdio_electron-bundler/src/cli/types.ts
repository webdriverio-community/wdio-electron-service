import type { RollupOptions } from 'rollup';

// CLI option interfaces
export interface BaseOptions {
  cwd: string;
}

export interface BuildOptions extends BaseOptions {
  dryRun?: boolean;
  exportConfig?: string | boolean;
  verbose?: boolean;
  extraVerbose?: boolean;
}

// Bundler configuration interfaces
export interface Transformation {
  type: 'injectDependency' | 'codeReplace';
  options: Record<string, any>;
}

export interface BundlerFormatConfig extends Partial<RollupOptions> {
  nodeExternals?: {
    exclude?: string | string[];
  };
}

export interface BundlerConfig {
  packageRoot?: string;
  esm?: BundlerFormatConfig;
  cjs?: BundlerFormatConfig | boolean;
  transformations?: Transformation[];
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name: string;
  version: string;
  exports?: Record<string, string | Record<string, string>>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Package information extracted from package.json
 */
export interface PackageInfo {
  name: string;
  version: string;
  input: Record<string, string>;
  outDir: {
    esm: string;
    cjs: string;
  };
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
}

/**
 * Import specification for generated config
 */
export interface ImportSpec {
  from: string;
  default?: string;
  named?: string[];
}

/**
 * Plugin specification with call string and import requirements
 */
export interface PluginSpec {
  name: string;
  call: string;
  options?: Record<string, any>;
  import: ImportSpec;
  inline?: boolean;
}

/**
 * Inline plugin specification (no imports needed)
 */
export interface InlinePluginSpec {
  name: string;
  code: string;
}

/**
 * Output configuration with inline plugins
 */
export interface OutputSpec {
  format: 'esm' | 'cjs';
  dir: string;
  sourcemap: boolean;
  plugins: InlinePluginSpec[];
}

/**
 * Complete configuration specification for one format
 */
export interface ConfigSpec {
  input: Record<string, string>;
  output: OutputSpec;
  plugins: PluginSpec[];
  format: 'esm' | 'cjs';
}

/**
 * Generated rollup configuration with all metadata
 */
export interface GeneratedRollupConfig {
  imports: ImportSpec[];
  configs: ConfigSpec[];
  packageInfo: PackageInfo;
}
