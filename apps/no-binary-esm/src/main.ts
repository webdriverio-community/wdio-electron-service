import { app, BrowserWindow, ipcMain } from 'electron';
const isTest = process.env.TEST === 'true';

if (isTest) {
  await import('wdio-electron-service/main');
}

const appPath = app.getAppPath();
let mainWindow: BrowserWindow;

app.on('ready', () => {
  console.log('main log');
  console.warn('main warn');
  console.error('main error');

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

  ipcMain.handle('increase-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height + 10, width: bounds.width + 10 });
  });

  ipcMain.handle('decrease-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height - 10, width: bounds.width - 10 });
  });
});
