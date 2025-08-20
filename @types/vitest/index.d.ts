interface CustomMatchers<R = unknown> {
  anyMockFunction(): R;
}
declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export * from 'vitest';
