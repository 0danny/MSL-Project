const { app, BrowserWindow, ipcRenderer } = require('electron')
const path = require('path')

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 600,
        height: 800,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    mainWindow.menuBarVisible = false

    mainWindow.loadFile(path.resolve(__dirname, '../public/index.html'))

    mainWindow.webContents.openDevTools()

    mainWindow.on('close', function(e) {
        mainWindow.webContents.send('close')
    })
}



app.whenReady().then(() => {
    app.allowRendererProcessReuse = false

    createWindow()

    app.on('activate', function() {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') app.quit()
})