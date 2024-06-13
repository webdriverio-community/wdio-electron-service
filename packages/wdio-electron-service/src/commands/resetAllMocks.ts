import mockStore from '../mockStore.js';

export async function resetAllMocks(apiName?: string) {
  for (const [mockName, mock] of mockStore.getMocks()) {
    if (!apiName || mockName.match(new RegExp(`^electron.${apiName}`))) {
      await mock.mockReset();
    }
  }
}
