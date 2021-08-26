const electron = require('electron');
const child_process = require('child_process');
const dialog = electron.dialog;

const fs = require('fs')
const readline = require('readline');
const { Console } = require('console');

$(function() {
    beginFlow()

    readConfig()
})

/*`*/

var currentProcess = null
var currentPath = 'renderer/server'
var serverFileName = 'FTBServer-1.6.4-965.jar'

function sendToast(text) {
    var toastLiveExample = document.getElementById('liveToast')
    var toast = new bootstrap.Toast(toastLiveExample)

    toastLiveExample.innerText = text

    toast.show()
}

function readConfig() {
    var lineReader = readline.createInterface({
        input: fs.createReadStream(currentPath + '/server.properties')
    })

    lineReader.on('line', function(line) {
        if (line.charAt(0) != "#") {
            var lineSplit = line.split('=')

            $('#serverConfigBox').append(`<div class="input-group mt-3">
            <span class="input-group-text" id="${lineSplit[0]}">${lineSplit[0]}</span>
            <input type="text" class="form-control" id="${lineSplit[0]}-inputBox" aria-describedby="${lineSplit[0]}" value="${lineSplit[1]}">
            </div>`)
        }
        console.log("Prop Lines: ", line)
    })

    lineReader.on('close', () => {
        console.log("Finished reading the config.")
        sendToast("Finished reading config.")
    })
}

function startServer(data) {
    var args = [
        `cd ${currentPath}`,
        `java -Xms${data.RAM}G -Xmx${data.RAM}G -XX:PermSize=${data.PERM}mb -jar ${serverFileName} nogui`
    ]

    console.log("Starting with: ", data)

    command = ["/c", args.join('&')]

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
        $('#outputBox').append(`<li class="list-group-item">${data}</li>`)
        $('#outputBox').stop().animate({ scrollTop: $('#outputBox')[0].scrollHeight }, 500)

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
}

function sendMessage(msg) {
    currentProcess.stdin.write(`${msg}\n`);
}

function preCloseClean() {
    currentProcess.stdin.end();
}


function beginFlow() {

    $('#sendMessageButton').on('click', function() {
        sendMessage($('#messageInput').val())
    })

    $('#saveButton').on('click', function() {
        sendMessage('save-all')
    })

    $('#startServerButton').on('click', function() {
        if ($('#startServerButton').text() == "Stop Server") {
            sendMessage('stop')

            preCloseClean()

            $('#startServerButton').text('Start Server')
        } else {
            startServer({ RAM: $('#ram-inputBox').val(), PERM: $('#permSize-inputBox').val() })

            $('#startServerButton').text('Stop Server')
        }
    })
}