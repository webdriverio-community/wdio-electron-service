import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

function createWindow(): BrowserWindow {
  // Use app.getAppPath() to get the absolute path to the app directory
  // This is more reliable than __dirname in different environments
  const appPath = app.getAppPath();

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: join(appPath, 'out', 'preload', 'index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Enable devtools in development
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(appPath, 'out', 'renderer', 'index.html'));
  }

  return mainWindow;
}

// IPC handlers for testing
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
});

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
