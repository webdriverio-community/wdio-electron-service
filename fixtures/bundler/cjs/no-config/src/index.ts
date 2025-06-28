export const greeting = 'Hello from CJS no-config fixture!';

export function getMessage(name: string): string {
  return `${greeting} Welcome, ${name}!`;
}

export default greeting;
