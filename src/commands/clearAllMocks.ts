import mockStore from '../mockStore.js';
import log from '../log.js';

export async function clearAllMocks(apiName?: string) {
  for (const [mockName, mock] of mockStore.getMocks()) {
    if (!apiName || mockName.match(new RegExp(`^electron.${apiName}`))) {
      log.debug('resetting mock', mockName);
      await mock.mockClear();
    }
  }
}
