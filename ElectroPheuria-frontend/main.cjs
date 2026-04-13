const { app, BrowserWindow } = require('electron');
const path = require('path');

// Use a dedicated cache directory to avoid permission conflicts
app.setPath('userData', path.join(app.getPath('appData'), 'ElectroPheuria'));
app.commandLine.appendSwitch('disable-gpu-cache');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  // Load only the Dashboard route
  win.loadURL('http://localhost:5173/dashboard');
}

app.whenReady().then(createWindow);
