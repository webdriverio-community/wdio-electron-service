import path from 'node:path';
import { z } from 'zod';

/**
 * Environment variable schema for E2E tests
 * Provides type safety and validation for all test configuration
 */
export const EnvSchema = z.object({
  // Core test configuration
  PLATFORM: z.enum(['builder', 'forge', 'no-binary']).default('builder'),
  MODULE_TYPE: z.enum(['cjs', 'esm']).default('esm'),
  TEST_TYPE: z.enum(['standard', 'window', 'multiremote', 'standalone']).default('standard'),
  BINARY: z.enum(['true', 'false']).default('true'),

  // Special modes
  MAC_UNIVERSAL: z.enum(['true', 'false']).default('false'),
  ENABLE_SPLASH_WINDOW: z.enum(['true', 'false']).optional(),

  // Test execution
  // Accepts string or number; coerces to a positive integer
  CONCURRENCY: z.coerce.number().int().min(1).default(1),
  WDIO_VERBOSE: z.enum(['true', 'false']).optional(),
  WDIO_MATRIX_DEBUG: z.enum(['true', 'false']).optional(),

  // App directory override (for testing)
  APP_DIR: z.string().optional(),
  EXAMPLE_DIR: z.string().optional(),
});

export type TestEnvironment = z.infer<typeof EnvSchema>;

/**
 * Validate and parse environment variables
 */
export function validateEnvironment(env: Record<string, string | undefined> = process.env): TestEnvironment {
  try {
    return EnvSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');

      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Type-safe environment context with computed properties
 */
export class EnvironmentContext {
  constructor(public readonly env: TestEnvironment) {}

  get platform(): 'builder' | 'forge' | 'no-binary' {
    return this.env.PLATFORM;
  }

  get moduleType(): 'cjs' | 'esm' {
    return this.env.MODULE_TYPE;
  }

  get testType(): 'standard' | 'window' | 'multiremote' | 'standalone' {
    return this.env.TEST_TYPE;
  }

  get isBinary(): boolean {
    return this.env.BINARY === 'true';
  }

  get isNoBinary(): boolean {
    return this.platform === 'no-binary' || !this.isBinary;
  }

  get isMacUniversal(): boolean {
    return this.env.MAC_UNIVERSAL === 'true';
  }

  get isMultiremote(): boolean {
    return this.testType === 'multiremote';
  }

  get isSplashEnabled(): boolean {
    return this.env.ENABLE_SPLASH_WINDOW === 'true';
  }

  get concurrency(): number {
    return this.env.CONCURRENCY;
  }

  /**
   * Get the app directory name for this environment
   */
  get appDirName(): string {
    if (this.env.EXAMPLE_DIR) {
      return this.env.EXAMPLE_DIR;
    }

    return this.isNoBinary ? `no-binary-${this.moduleType}` : `${this.platform}-${this.moduleType}`;
  }

  /**
   * Get the full app directory path
   */
  get appDirPath(): string {
    return path.join(process.cwd(), '..', 'fixtures', 'e2e-apps', this.appDirName);
  }

  /**
   * Validate environment compatibility
   */
  validateCompatibility(): void {
    // Mac Universal mode validation
    if (this.isMacUniversal) {
      if (!['builder', 'forge'].includes(this.platform)) {
        throw new Error(`MAC_UNIVERSAL mode only supports builder and forge platforms, got: ${this.platform}`);
      }
      if (!this.isBinary) {
        throw new Error('MAC_UNIVERSAL mode requires binary mode (BINARY=true)');
      }
    }

    // No-binary validation
    if (this.platform === 'no-binary' && this.isBinary) {
      throw new Error('no-binary platform cannot be used with binary mode');
    }

    // Test type validation
    if (this.testType === 'window' && !this.isSplashEnabled) {
      console.warn('Window tests typically require ENABLE_SPLASH_WINDOW=true for full functionality');
    }
  }

  /**
   * Create child environment for test execution
   */
  createChildEnvironment(overrides: Partial<TestEnvironment> = {}): Record<string, string> {
    const merged = { ...this.env, ...overrides };

    return {
      PLATFORM: merged.PLATFORM,
      MODULE_TYPE: merged.MODULE_TYPE,
      TEST_TYPE: merged.TEST_TYPE,
      BINARY: merged.BINARY,
      APP_DIR: merged.APP_DIR || '',
      EXAMPLE_DIR: merged.EXAMPLE_DIR || this.appDirName,
      ...(merged.MAC_UNIVERSAL === 'true' && { MAC_UNIVERSAL: 'true' }),
      ...(merged.ENABLE_SPLASH_WINDOW === 'true' && { ENABLE_SPLASH_WINDOW: 'true' }),
      ...(merged.WDIO_VERBOSE === 'true' && { WDIO_VERBOSE: 'true' }),
      ...(merged.WDIO_MATRIX_DEBUG === 'true' && { WDIO_MATRIX_DEBUG: 'true' }),
    };
  }

  /**
   * Get human-readable description of this environment
   */
  toString(): string {
    const parts = [this.platform, this.moduleType, this.testType, this.isBinary ? 'binary' : 'no-binary'];

    if (this.isMacUniversal) parts.push('mac-universal');
    if (this.isSplashEnabled) parts.push('splash');

    return parts.join('-');
  }
}

/**
 * Create and validate environment context
 */
export function createEnvironmentContext(env?: Record<string, string | undefined>): EnvironmentContext {
  const validatedEnv = validateEnvironment(env);
  const context = new EnvironmentContext(validatedEnv);
  context.validateCompatibility();
  return context;
}
