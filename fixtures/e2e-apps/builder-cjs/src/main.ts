import { app, BrowserWindow, dialog, ipcMain } from 'electron';

const isTest = process.env.TEST === 'true';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);

const appPath = app.getAppPath();
const appRootPath = `${appPath}/dist`;
const resourcePaths = {
  preloadJs: `${appRootPath}/preload.js`,
  splashHtml: `${appRootPath}/splash.html`,
  indexHtml: `${appRootPath}/index.html`,
} as const;

let mainWindow: BrowserWindow;
let splashWindow: BrowserWindow;

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    x: 25,
    y: 35,
    width: 200,
    height: 300,
    webPreferences: {
      preload: resourcePaths.preloadJs,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow.destroy();
  });
  mainWindow.loadFile(resourcePaths.indexHtml);

  mainWindow.on('ready-to-show', () => {
    mainWindow.title = 'this is the title of the main window';
    // mainWindow.webContents.openDevTools();
  });
};

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    x: 25,
    y: 110,
    width: 200,
    height: 200,
    frame: false,
    webPreferences: {
      preload: resourcePaths.preloadJs,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile(resourcePaths.splashHtml);
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
};

app.on('ready', () => {
  console.log('main log');
  console.warn('main warn');
  console.error('main error');

  if (isSplashEnabled) {
    createSplashWindow();

    // to minimize the E2E test duration, we can switch to the main window programmatically
    ipcMain.handle('switch-main-window', () => {
      splashWindow.hide();
      createMainWindow();
      splashWindow.destroy();
    });
  } else {
    createMainWindow();
  }

  ipcMain.handle('increase-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height + 10, width: bounds.width + 10 });
  });

  ipcMain.handle('decrease-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height - 10, width: bounds.width - 10 });
  });

  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select txt',
      filters: [
        { name: 'TXT', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'openDirectory'],
    });
    console.log(result);
    return result;
  });
});
