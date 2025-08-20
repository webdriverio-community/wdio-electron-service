export const greeting = 'Hello from ESM no-config fixture!';

export function getMessage(name: string): string {
  return `${greeting} Welcome, ${name}!`;
}

export default greeting;
