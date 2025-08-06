import { describe, expect, it, vi } from 'vitest';

import * as index from '../src/index.js';

vi.mock('../src/getAppBuildInfo', () => {
  return {
    getAppBuildInfo: vi.fn(),
  };
});

vi.mock('../src/getBinaryPath', () => {
  return {
    getBinaryPath: vi.fn(),
  };
});

vi.mock('../src/getElectronVersion', () => {
  return {
    getElectronVersion: vi.fn(),
  };
});

describe('index', () => {
  it('should export getAppBuildInfo', () => {
    expect(index.getAppBuildInfo).toEqual(expect.any(Function));
  });

  it('should export getBinaryPath', () => {
    expect(index.getBinaryPath).toEqual(expect.any(Function));
  });

  it('should export getElectronVersion', () => {
    expect(index.getElectronVersion).toEqual(expect.any(Function));
  });
});
