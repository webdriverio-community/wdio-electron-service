import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get path to a fixture directory or file
 * @param fixtureType - The fixture type (e.g., 'build-esm', 'build-cjs')
 * @param fixtureName - The fixture name (e.g., 'build-test-esm', 'no-config')
 * @param fileName - Optional file name to append (e.g., 'package.json')
 * @returns Path to the fixture directory or file
 */
export function getFixturePath(fixtureType: string, fixtureName: string, fileName?: string): string {
  const basePath = path.resolve(__dirname, '..', '..', '..', '..', 'fixtures', fixtureType, fixtureName);
  return fileName ? path.join(basePath, fileName) : basePath;
}

/**
 * Get path to a bundler build test package directory
 * @param moduleType - The module type ('cjs' or 'esm')
 * @param fixtureName - The fixture name (e.g., 'no-config')
 * @returns Path to the fixture directory
 */
export function getBundlerFixturePath(moduleType: 'cjs' | 'esm', fixtureName: string): string {
  return getFixturePath(`build-${moduleType}`, fixtureName);
}

/**
 * Get path to a fixture package.json file
 * @param fixtureType - The fixture type (e.g., 'build-esm', 'build-cjs')
 * @param fixtureName - The fixture name (e.g., 'build-test-esm')
 * @returns Path to the package.json file
 */
export function getFixturePackagePath(fixtureType: string, fixtureName: string): string {
  return getFixturePath(fixtureType, fixtureName, 'package.json');
}
