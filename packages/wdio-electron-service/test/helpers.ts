const originalProperties: { [key: string]: unknown } = {};

export function mockProcessProperty(name: string, value: string) {
  originalProperties[name] = process[name as keyof typeof process];
  Object.defineProperty(process, name, {
    value,
    configurable: true,
    writable: true,
  });
}

export function revertProcessProperty(name: string) {
  Object.defineProperty(process, name, {
    value: originalProperties[name],
  });
}
