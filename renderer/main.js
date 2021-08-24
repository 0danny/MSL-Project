const { app, BrowserWindow } = require('electron')
const { InitServer, ForceQuit } = require('./server.js')
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

    console.log("Begin: Server")

    var args = [
        "cd renderer/test-server",
        "java -Xms2048m -Xmx2048m -XX:PermSize=128m -jar FTBServer-1.6.4-965.jar nogui"
    ]

    InitServer(["/c", args.join('&')], mainWindow, function(pid) {
        console.log("Callback: ", pid)
    })
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function() {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('closed', () => {

})

app.on('window-all-closed', function() {

    if (process.platform !== 'darwin') app.quit()
})