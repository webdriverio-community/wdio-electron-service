export * from 'vitest';
interface CustomMatchers<R = unknown> {
  anyMockFunction(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
