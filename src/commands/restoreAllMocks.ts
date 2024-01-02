import mockStore from '../mockStore.js';
import log from '../log.js';

export async function restoreAllMocks(apiName?: string) {
  for (const [mockName, mock] of mockStore.getMocks()) {
    if (!apiName || mockName.match(new RegExp(`^electron.${apiName}`))) {
      log.debug('restoring mock', mockName);
      await mock.mockRestore();
      mockStore.removeMock(mockName);
    }
  }
}
