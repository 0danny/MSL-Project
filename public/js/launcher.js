require('app-module-path').addPath(__dirname);

//imports
const { ipcRenderer, app, remote } = require('electron')
const child_process = require('child_process')
const fs = require('fs')
const path = require('path')
const { readSettings, writeSettings, settingsObject } = require('js/settingsParser')
const { sendToast } = require('js/helper');
const { initImportHandler } = require('js/importHandler')
const { initServerHandler } = require('js/serverHandler')
const pathHandlerObj = require('js/pathHandler')


$(function() {
    console.log("[MSL] Project has begun Initialisation: ", pathHandlerObj.getWorkingDirectory())

    beginFlow()

    initImportHandler()
    initServerHandler()
    readSettings()
})

var currentProcess = null
var players = []

async function startServer(data) {

    var JVMArguments = $('#jvmArgumentsBox').val().split(' ')

    //path.resolve(__dirname, `../${currentPath}/${currentServerName}/${serverFileName}`)

    var args = [`-Xms${data.RAM}G`, `-Xmx${data.RAM}G`]

    if ($("#useArguments").is(':checked') && JVMArguments.length > 0) {
        args = args.concat(JVMArguments)
    }

    args.push('-jar')
    args.push(pathHandlerObj.getServerFilePath())
    args.push('nogui')

    console.log("Starting with: ", data)
    console.log("Arguments: ", args)

    //"C:\\Program Files\\Java\\jdk1.8.0_221\\bin\\java.exe"

    currentProcess = child_process.spawn('java', args, { cwd: pathHandlerObj.getServerPath() })

    currentProcess.on('error', (error) => {
        sendToast("There was an error starting the process: " + error)
    })

    currentProcess.stdout.setEncoding('utf8');
    currentProcess.stdout.on('data', (data) => {
        console.log("Data: ", data)
        handleConsoleOutput(data, 'stdout')
    })

    currentProcess.stderr.setEncoding('utf8');
    currentProcess.stderr.on('data', (data) => {
        console.log("Err: ", data)
        handleConsoleOutput(data, 'stderr')
    })

    currentProcess.on('close', (code) => {
        sendToast("The server has been completely stopped.")

        $('#pills-normal').html('')
        $('#pills-error').html('')
    })
}

function handleConsoleOutput(data, type) {
    if (type == 'stderr') {
        $(`#pills-error`).append(`<li class="list-group-item">${data}</li>`)

        $(`#pills-error`).stop().animate({ scrollTop: $(`#pills-error`)[0].scrollHeight }, 500)

        return
    }

    if (data.includes("logged in with entity id") || data.includes('left the game')) {
        parsePlayer(data)
    }

    $(`#pills-normal`).append(`<li class="list-group-item">${data}</li>`)

    $(`#pills-normal`).stop().animate({ scrollTop: $(`#pills-normal`)[0].scrollHeight }, 500)
}

function safelyForceQuit() {
    sendToast("Force quitting server...")
    writeSettings()

    if (currentProcess != null) {
        sendMessage('save-all')
        $('#messageInput').val('')
        $('#pills-normal').html('')
        $('#pills-error').html('')
        currentProcess.stdin.end();
        currentProcess.kill()
    }
}

function parsePlayer(data) {
    if (data.includes('left the game')) {
        var match = /^\[(.*?)\]\s\[(.*?)\]:\s(.*?)\sleft the game/g.exec(data.trim())

        if (players.includes(match[3])) {
            sendToast(`${match[3]} has left the game.`)

            $(`#${match[3]}-playerobject`).remove()
            players.splice(players.indexOf(match[3]), 1)
        }
    } else {

        var match = /^\[(.*?)\]\s(.+?):\s(.*?)\[(.*?)\] logged in with entity id (.*?) at \((.*?)\)/g.exec(data.trim())

        var IPSplit = match[4].split(':')

        $('#playersBox').append(`<li class="list-group-item shadow-sm d-flex flex-column" id="${match[3]}-playerobject">
            <div class="d-flex flex-row align-items-center">
                <medium><b>${match[3]}</b></medium>
                <div class="fs-5 ms-auto text-primary">${match[5]}</div>
            </div>
            <small>Last saved coordinates: <font color="red">(${match[6]})</font></small>
            <small>IP Address & Port: <font color="orange">${IPSplit[0].slice(1)} | ${IPSplit[1]}</font></small>
            <small>Logged in at: <font color="green">${match[1]}</font></small>

            <div class="d-flex flex-row pt-2">
                <button class="btn btn-danger w-100 me-1" type="button" id="banButton" playerName="${match[3]}">Ban</button>
                <button class="btn btn-warning w-100 me-1" type="button" id="kickButton" playerName="${match[3]}">Kick</button>
                <button class="btn btn-success w-100 me-1" type="button" id="giveOPButton" playerName="${match[3]}">Give OP</button>
                <button class="btn btn-danger w-100" type="button" id="removeOPButton" playerName="${match[3]}">Remove OP</button>
            </div>
        </li>`)

        sendToast("A new player joined: " + match[3])

        players.push(match[3])
    }

    $('#playersConnected').html(`<b>${players.length}</b> Players Connected`)
}

function sendMessage(msg) {
    if (currentProcess != null) {
        currentProcess.stdin.write(`${msg}\n`);
    }
}

function preCloseClean() {
    currentProcess.stdin.end();
}

function beginFlow() {

    $(document).on('click', '#unloadButton', function() {
        var pathObject = path.parse($(this).attr('pluginName'))
        var newPath = null

        if (pathObject.ext == '.disabled') {
            newPath = `${pathHandlerObj.getServerPath()}/mods/${pathObject.base.replace(pathObject.ext, '')}`
            $(this).attr('pluginName', `${pathObject.base.replace(pathObject.ext, '')}`).text('Unload').removeClass('btn-success').addClass('btn-danger')
        } else {
            newPath = `${pathHandlerObj.getServerPath()}/mods/${pathObject.base}.disabled`
            $(this).attr('pluginName', `${pathObject.base}.disabled`).text('Load').removeClass('btn-danger').addClass('btn-success')
        }

        fs.rename(`${pathHandlerObj.getServerPath()}/mods/${pathObject.base}`, newPath, function(err) {
            if (err) console.log('ERROR: ' + err)
        })
    })

    $(document).on('click', '#banButton', function() {
        sendMessage(`ban ${$(this).attr('playerName')}`)
    })

    $(document).on('click', '#kickButton', function() {
        sendMessage(`kick ${$(this).attr('playerName')}`)
    })

    $(document).on('click', '#giveOPButton', function() {
        sendMessage(`op ${$(this).attr('playerName')}`)
    })

    $(document).on('click', '#removeOPButton', function() {
        sendMessage(`deop ${$(this).attr('playerName')}`)
    })

    $('#sendMessageButton').on('click', function() {
        sendMessage($('#messageInput').val())
        $('#messageInput').val('')
    })

    $('#saveButton').on('click', function() {
        sendMessage('save-all')
    })

    $('#savePropertiesButton').on('click', function() {
        sendToast("Saving server configuration...")
        saveProperties()
    })

    ipcRenderer.on('close', () => {
        safelyForceQuit()
    })

    $('#forceQuitButton').on('click', function() {
        safelyForceQuit()
    })

    $('#messageInput').on('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage($('#messageInput').val())
            $('#messageInput').val('')
        }
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