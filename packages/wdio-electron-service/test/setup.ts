import { expect, vi } from 'vitest';

expect.extend({
  anyMockFunction(received) {
    const { isNot } = this;
    return {
      pass: vi.isMockFunction(received),
      message: () => `${received} is${isNot ? ' not' : ''} a Mock`,
    };
  },
});
