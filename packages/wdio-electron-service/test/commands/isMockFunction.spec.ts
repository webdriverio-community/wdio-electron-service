/// <reference types="../../@types/vitest" />
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

import { createMock } from '../../src/mock.js';
import { isMockFunction } from '../../src/commands/isMockFunction.js';

describe('isMockFunction Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {
        execute: vi.fn(),
      },
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true for an Electron mock', async () => {
    const mockFn = await createMock('app', 'getName');
    expect(isMockFunction(mockFn)).toBe(true);
  });

  it('should return false for a function', () => {
    expect(isMockFunction(() => {})).toBe(false);
  });

  it('should return false for a vitest mock', () => {
    expect(isMockFunction(vi.fn())).toBe(false);
  });
});
