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
  options: Record<string, unknown>;
}

export interface BundlerFormatConfig {
  /** Packages to bundle (instead of externalizing) */
  bundle?: string[];
  /** Additional packages to force externalize (even if bundling their parent) */
  external?: string[];
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
  type?: 'module' | 'commonjs';
  main?: string;
  module?: string;
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
  type: 'module' | 'commonjs';
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
  options?: Record<string, unknown> | Record<string, unknown>[];
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
  dynamicImportInCjs?: boolean;
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

/**
 * TypeScript compiler options interface
 */
export interface CompilerOptions {
  target?: string;
  module?: string;
  moduleResolution?: string;
  allowSyntheticDefaultImports?: boolean;
  esModuleInterop?: boolean;
  skipLibCheck?: boolean;
  noEmitOnError?: boolean;
  outDir?: string;
  declaration?: boolean;
  declarationMap?: boolean;
}

/**
 * TypeScript plugin options
 */
export interface TypeScriptPluginOptions {
  compilerOptions: CompilerOptions;
  typescript?: unknown;
  include?: string[];
  exclude?: string[];
  tsconfig?: false | string;
}

/**
 * Rollup log object interface
 */
export interface RollupLogMessage {
  code?: string;
  message: string;
  loc?: {
    file?: string;
    line: number;
    column: number;
  };
  frame?: string;
  toString(): string;
}

/**
 * Serialized object for config loading
 */
export interface SerializedObject {
  __type?: 'function' | 'regexp';
  __value?: string;
  [key: string]: unknown;
}
