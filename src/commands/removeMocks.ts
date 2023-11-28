export async function removeMocks(apiName?: string) {
  for (const mockName in browser.electron._mocks) {
    const mock = browser.electron._mocks[mockName];
    if (!apiName || mock.apiName === apiName) {
      mock.unMock();
    }
  }
}
