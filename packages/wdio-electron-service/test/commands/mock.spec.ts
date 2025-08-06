import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { createMock } from '../../src/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mock.js', () => ({
  createMock: vi.fn(),
}));
vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMock: vi.fn(),
    setMock: vi.fn(),
  },
}));

let mock: any;

beforeEach(async () => {
  mock = (await import('../../src/commands/mock.js')).mock;
});

afterEach(() => {
  vi.resetModules();
});

describe('mock Command', () => {
  let mockedGetName: any;

  beforeEach(async () => {
    mockedGetName = {
      getMockName: () => 'electron.app.getName',
      mockReset: vi.fn(),
    };
  });

  it('should return an existing mock', async () => {
    (mockStore.getMock as Mock).mockReturnValue(mockedGetName);

    const retrievedMock = await mock('app', 'getName');
    expect(mockStore.getMock).toBeCalledWith('electron.app.getName');
    expect(retrievedMock).toStrictEqual(mockedGetName);
  });

  it('should reset an existing mock', async () => {
    (mockStore.getMock as Mock).mockReturnValue(mockedGetName);

    const retrievedMock = await mock('app', 'getName');
    expect(retrievedMock.mockReset).toHaveBeenCalled();
  });

  describe('when there is no existing mock', () => {
    beforeEach(() => {
      (mockStore.getMock as Mock).mockImplementation(() => {
        throw new Error('No mock by that name');
      });
    });

    it('should create a new mock', async () => {
      (createMock as Mock).mockReturnValue(mockedGetName);

      const createdMock = await mock('app', 'getName');
      expect(createdMock.getMockName()).toBe('electron.app.getName');
    });

    it('should put newly created mocks in the store', async () => {
      (createMock as Mock).mockReturnValue(mockedGetName);

      await mock('app', 'getName');
      expect(mockStore.setMock).toBeCalledWith(mockedGetName);
    });
  });
});
