import mockStore from '../mockStore.js';

export async function removeMocks(apiName?: string) {
  for (const mockName in mockStore.mockFns) {
    const mock = mockStore.getMock(mockName);
    if (!apiName || (await mock).getMockName() === apiName) {
      (await mock).mockRestore();
    }
  }
}
