import { type AsyncMock, createMock } from '../mock.js';
import mockStore from '../mockStore.js';

export async function mock(apiName: string, funcName: string): Promise<AsyncMock> {
  const mockObj = createMock(apiName, funcName);
  const updatedMockObj = await mockObj.mockImplementation(() => undefined);
  return mockStore.setMock(updatedMockObj);
}
