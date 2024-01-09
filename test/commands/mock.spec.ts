import { vi, describe, beforeEach, it, expect, Mock, afterEach } from 'vitest';

import { mock } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';
import { createMock } from '../../src/mock.js';

vi.mock('../../src/mock.js', () => ({
  createMock: vi.fn(),
}));

describe('mock', () => {
  let mockedGetName;

  beforeEach(async () => {
    mockedGetName = {
      getMockName: () => 'electron.app.getName',
      mockReset: vi.fn(),
    };
  });

  afterEach(() => {
    mockStore.removeMock('electron.app.getName');
  });

  it('should return an existing mock', async () => {
    mockStore.setMock(mockedGetName);

    const retrievedMock = await mock('app', 'getName');
    expect(retrievedMock).toBe(mockedGetName);
  });

  it('should reset an existing mock', async () => {
    mockStore.setMock(mockedGetName);

    const retrievedMock = await mock('app', 'getName');
    expect(retrievedMock.mockReset).toHaveBeenCalled();
  });

  it('should create a new mock', async () => {
    (createMock as Mock).mockResolvedValue(mockedGetName);

    const createdMock = await mock('app', 'getName');
    expect(createdMock).toBe(mockedGetName);
  });

  it('should put newly created mocks in the store', async () => {
    (createMock as Mock).mockResolvedValue(mockedGetName);

    await mock('app', 'getName');
    const storedMock = mockStore.getMock('electron.app.getName');
    expect(storedMock).toBe(mockedGetName);
  });
});
