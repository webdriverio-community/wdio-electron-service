import { type AsyncMock, createMock } from '../mock.js';
import mockStore from '../mockStore.js';

export async function mock(apiName: string, funcName: string): Promise<AsyncMock> {
  const mock = createMock(apiName, funcName);
  await mock.mockImplementation(() => undefined);
  return mockStore.setMock(mock);
}
