export const greeting = 'Hello from ESM simple-ts-config fixture!';

export interface Config {
  name: string;
  version: string;
}

export function createConfig(name: string, version: string): Config {
  return { name, version };
}

export default greeting;
