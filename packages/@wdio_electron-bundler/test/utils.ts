import { join } from 'node:path';

export function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return join(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}
