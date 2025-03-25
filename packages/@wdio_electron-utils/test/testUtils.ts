import path from 'node:path';
import fs from 'node:fs/promises';

export async function getFixturePackageJson(moduleType: string, fixtureName: string) {
  const packageJsonPath = path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return {
    packageJson,
    path: packageJsonPath,
  };
}
