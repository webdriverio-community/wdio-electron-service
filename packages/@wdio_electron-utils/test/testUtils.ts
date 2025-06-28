import path, { normalize } from 'node:path';
import fs from 'node:fs/promises';
import { vi } from 'vitest';

export async function getFixturePackageJson(fixtureType: string, fixtureName: string) {
  const packageJsonPath = path.resolve(process.cwd(), '..', '..', 'fixtures', fixtureType, fixtureName, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return {
    packageJson,
    path: packageJsonPath,
  };
}

export function mockBinaryPath(expectedPath: string | string[]) {
  const target = Array.isArray(expectedPath) ? expectedPath.map((p) => normalize(p)) : [normalize(expectedPath)];
  vi.mocked(fs.access).mockImplementation(async (path, _mode?) => {
    if (target.includes(normalize(path.toString()))) {
      return Promise.resolve();
    } else {
      return Promise.reject('Not executable');
    }
  });
}
