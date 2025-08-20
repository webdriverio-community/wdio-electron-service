import type { ElectronMock } from '@wdio/electron-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronServiceMockStore } from '../src/mockStore.js';

let mockStore: ElectronServiceMockStore;

beforeEach(async () => {
  mockStore = (await import('../src/mockStore.js')).default;
});

afterEach(() => {
  vi.resetModules();
});

describe('Mock Store', () => {
  const testMock = { getMockName: () => 'test mock' } as unknown as ElectronMock;

  it('should set and get a specific mock', () => {
    mockStore.setMock(testMock);
    expect(mockStore.getMock('test mock')).toBe(testMock);
  });

  it('should throw an error when there is no stored mock with a given ID', () => {
    mockStore.setMock(testMock);
    expect(() => mockStore.getMock('not a stored mock')).toThrow('No mock registered for "not a stored mock"');
  });
});

describe('getMocks', () => {
  it('should retrieve all stored mocks', () => {
    const testMock1 = { getMockName: () => 'test mock 1' } as unknown as ElectronMock;
    const testMock2 = { getMockName: () => 'test mock 2' } as unknown as ElectronMock;
    const testMock3 = { getMockName: () => 'test mock 3' } as unknown as ElectronMock;
    mockStore.setMock(testMock1);
    mockStore.setMock(testMock2);
    mockStore.setMock(testMock3);
    expect(mockStore.getMocks()).toStrictEqual([
      ['test mock 1', testMock1],
      ['test mock 2', testMock2],
      ['test mock 3', testMock3],
    ]);
  });
});
