/* eslint no-console: off, global-require: off */
const { app, BrowserWindow, ipcMain } = require('electron');
const { isTest } = require('./util');

if (isTest) {
  require('wdio-electron-service/main');
}

const appPath = app.getAppPath();

const appRootPath = `${appPath}/dist`;
let mainWindow = null;

app.on('ready', () => {
  console.log('main log');
  console.warn('main warn');
  console.error('main error');

  global.mainProcessGlobal = 'foo';
  global.ipcEventCount = 0;

  mainWindow = new BrowserWindow({
    x: 25,
    y: 35,
    width: 200,
    height: 300,
    webPreferences: {
      preload: `${appRootPath}/preload.js`,
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadFile(`${appRootPath}/index.html`);

  mainWindow.on('ready-to-show', () => {
    mainWindow.title = 'this is the title of the main window';
    // mainWindow.webContents.openDevTools();
  });

  ipcMain.handle('increase-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height + 10, width: bounds.width + 10 });
  });

  ipcMain.handle('decrease-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height - 10, width: bounds.width - 10 });
  });

  // custom main process API
  ipcMain.handle('wdio-electron', () => 'test');
});

ipcMain.on('ipc-event', (event, count) => {
  global.ipcEventCount += count;
});
