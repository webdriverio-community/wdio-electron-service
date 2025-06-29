import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getAppName: () => Promise<string>;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
} as ElectronAPI);

// Add the API interface to the window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
