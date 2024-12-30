import { app, BrowserWindow, ipcMain } from 'electron';
const isTest = process.env.TEST === 'true';
const enableSplashWindow = !!process.env.ENABLE_SPLASH_WINDOW;

if (isTest) {
  await import('wdio-electron-service/main');
}

const appPath = app.getAppPath();
let mainWindow: BrowserWindow;
let splashWindow: BrowserWindow;

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    x: 25,
    y: 35,
    width: 200,
    height: 300,
    webPreferences: {
      preload: `${appPath}/preload.bundle.cjs`,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow.destroy();
  });
  mainWindow.loadFile(`${appPath}/index.html`);

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
      preload: `${appPath}/preload.bundle.cjs`,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile(`${appPath}/splash.html`);
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
};

app.on('ready', () => {
  console.log('main log');
  console.warn('main warn');
  console.error('main error');

  if (enableSplashWindow) {
    createSplashWindow();
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

  // to minimize the E2E test duration, we can switch to the main window programmatically
  ipcMain.handle('switch-main-window', () => {
    splashWindow.hide();
    createMainWindow();
    splashWindow.destroy();
  });
});
