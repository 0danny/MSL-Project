const electron = require('electron');
const child_process = require('child_process');
const dialog = electron.dialog;
const ipcRenderer = require('electron').ipcMain

var currentProcess

function InitServer(command, win, callback) {
    ipcRenderer.on('stopProcess', async function(evt, data) {
        sendMessage('stop')

        preCloseClean()
    })

    ipcRenderer.on('sendMessage', async function(evt, data) {
        sendMessage(data)
    })

    currentProcess = child_process.spawn('cmd.exe', command)

    currentProcess.on('error', (error) => {
        dialog.showMessageBox({
            title: 'Title',
            type: 'warning',
            message: 'Error occured.\r\n' + error
        })
    })

    currentProcess.stdout.setEncoding('utf8');
    currentProcess.stdout.on('data', (data) => {
        //Here is the output
        data = data.toString();
        console.log("Data: ", data);
    })

    currentProcess.stderr.setEncoding('utf8');
    currentProcess.stderr.on('data', (data) => {
        win.webContents.send('newData', data)

        //console.log("Error Data: ", data);
    })

    currentProcess.on('close', (code) => {

        switch (code) {
            case 0:
                dialog.showMessageBox({
                    title: 'Title',
                    type: 'info',
                    message: 'End process.\r\n'
                });
                break;
        }



    })
    if (typeof callback === 'function')
        callback(currentProcess.pid);


}

function sendMessage(msg) {
    currentProcess.stdin.write(`${msg}\n`);
}

function preCloseClean() {
    currentProcess.stdin.end();
}

module.exports = { InitServer }