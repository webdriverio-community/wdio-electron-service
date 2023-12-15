import { ElectronServiceMock } from '../mock.js';
import mockStore from '../mockStore.js';

// export class ElectronServiceMock {
//   apiName: string;

//   constructor(apiName: ElectronInterface) {
//     this.apiName = String(apiName);
//   }

//   async init(): Promise<Record<string, WrappedMockFn>> {
//     const apiFnNames = await browser.electron.execute(
//       (electron, apiName) => Object.keys(electron[apiName as keyof typeof electron]).toString(),
//       this.apiName,
//     );

//     const mockedApis: Record<string, WrappedMockFn> = apiFnNames
//       .split(',')
//       .reduce((a, funcName) => ({ ...a, [funcName]: 'placeholder' }), {});

//     for (const apiFn in mockedApis) {
//       mockedApis[apiFn as keyof typeof mockedApis] = await this.initFn(apiFn);
//     }

//     return mockedApis;
//   }

//   async initFn(funcName: string, mockImplementationFn?: MockFn, mockReturnValue?: unknown): Promise<WrappedMockFn> {
//     const mockId = `electron.${this.apiName}.${funcName}`;
//     const mock = {
//       mock: await mockStore.setMock(mockId, mockImplementationFn, mockReturnValue),
//       mockReturnValue: async (returnValue: unknown) => {
//         mock.mock = await mockStore.setMock(mockId, undefined, returnValue);
//         return mock.mock;
//       },
//       mockImplementation: async (implementationFn: () => unknown) => {
//         mock.mock = await mockStore.setMock(mockId, implementationFn);
//         return mock.mock;
//       },
//       unMock: this.unMock.bind(this, funcName),
//     };

//     return mock;
//   }

//   async unMock(funcName?: string) {
//     // when funcName is unspecified we unmock all of the mocked functions
//     if (!funcName) {
//       for (const [mockId] of mockStore.mockFns) {
//         await mockStore.unMock(mockId);
//       }
//       return;
//     }

//     const mockId = `electron.${this.apiName}.${funcName}`;
//     await mockStore.unMock(mockId);
//   }
// }

export async function mock(apiName: string, funcName: string) {
  const mock = new ElectronServiceMock(apiName, funcName);
  await mock.mockImplementation(() => undefined);
  mockStore.setMock(mock);
}
