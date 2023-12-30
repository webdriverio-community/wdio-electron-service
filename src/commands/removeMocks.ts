import mockStore from '../mockStore.js';
import log from '../log.js';

export async function removeMocks(apiName?: string) {
  for (const [mockName] of mockStore.getMocks()) {
    const mock = await mockStore.getMock(mockName);
    if (!apiName || mock.getMockName() === apiName) {
      log.debug('restoring mock', mock.getMockName());
      await mock.mockRestore();
    }
  }
}
