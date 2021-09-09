require('app-module-path').addPath(__dirname);

//imports
const { ipcRenderer, remote } = require('electron')
const child_process = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const dateFormat = require('dateformat');
const archive = require('ls-archive')
const { readSettings, writeSettings, settingsObject } = require('js/settingsParser.js')
const { sendToast } = require('js/helper');
const dialog = remote.dialog;

$(function() {
    beginFlow()

    readSettings()
    getServers()
})

var levelName = null
var currentProcess = null
var currentPath = 'renderer/servers'
var currentServerName = '/vanilla-server'
var serverFileName = null
var propertiesObject = []
var players = []

function getServers() {

    $(document).on('click', '#serverPickerButton', function() {

        switch ($(this).text()) {
            case 'New Server':
                return
            case 'Import Server':
                new bootstrap.Modal(document.getElementById('serverImportModal')).show()
                return
        }

        //This is hacky and shit because i'm assuming that serverData is always gonna be at index 0
        //var serverObject = settingsObject[0].serverData.filter(element => element.name == $(this).attr('serverName'))[0]

        $('#currentServerText').text($(this).attr('serverName'))

        currentServerName = `/${$(this).attr('serverName')}`

        //findVersion()
        readProperties()
        searchPlugins()
    })

    if (fs.existsSync(`${currentPath}`)) {

        fs.readdir(currentPath, async(err, files) => {

            if (files == undefined || files.length <= 0) {
                console.log("No servers installed.")
                return
            }

            files.forEach(file => {

                fs.stat(`${currentPath}/${file}`, async(err, stats) => {
                    if (err) {
                        console.log(`Error reading mode: ${file}.`)
                        throw err
                    }

                    console.log(file)

                    if (stats.isDirectory()) {
                        $('#serverDropDown').append(`<li><a class="dropdown-item" id="serverPickerButton" href="#" serverName=${file}>${file}</a></li>`)
                    }
                })
            })

            return true
        })
    } else {
        sendToast("Server's folder does not exist, cannot continue.")
        return false
    }
}

function findVersion(fileName) {
    serverFileName = fileName

    archive.readFile(`${currentPath}/${currentServerName}/${serverFileName}`, path.normalize("version.json"), function(err, manifestData) {
        if (!err) {
            var json = JSON.parse(manifestData.toString())

            $('#gameVersion').html(`Game version is: <b>${json.name}<b>`)
        } else {
            $('#gameVersion').html(`Game version is: <b>${path.parse(serverFileName).name}<b>`)
        }
    })
}

async function searchPlugins() {

    $('#pluginsBox').html('')
    $('#pluginsCount').text(`Installed Plugins: 0`)

    var folderPath = null

    if (fs.existsSync(`${currentPath}/${currentServerName}/plugins`)) {
        folderPath = `${currentPath}/${currentServerName}/plugins`
    } else if (fs.existsSync(`${currentPath}/${currentServerName}/mods`)) {
        folderPath = `${currentPath}/${currentServerName}/mods`
    }

    if (folderPath == null) {
        $('#pills-plugins-tab').parent().css('display', 'none')
        return
    } else {
        $('#pills-plugins-tab').parent().css('display', 'block')
    }

    await fs.promises.readdir(folderPath, async(err, files) => {

        files = files.filter(element => element.includes('.jar') || element.includes('.zip'))

        if (files == undefined || files.length <= 0) {
            $('#pills-plugins-tab').parent().css('display', 'none')
            console.log("No plugins installed.")
            return
        } else {
            $('#pills-plugins-tab').parent().css('display', 'block')
        }

        files.forEach(async function(file, index) {

            var filePath = `${folderPath}/${file}`

            await fs.promises.stat(filePath, async(err, stats) => {

                if (err) {
                    console.log(`Error reading mode: ${file}.`)
                    throw err
                }

                if (!stats.isDirectory()) {
                    var pathObject = path.parse(file)
                    var buttonName = 'Unload'
                    var buttonColor = 'danger'
                    var pluginName = pathObject.name
                    var version = Math.round(stats.size / 1024) + "Kb"

                    if (file.includes('.jar') || file.includes('.zip')) {

                        archive.readFile(filePath, path.normalize("mcmod.info"), function(err, manifestData) {
                            if (!err) {
                                var json = JSON.parse(manifestData.toString())

                                try {
                                    pluginName = json[0].name
                                    version += ` | ${json[0].version}`
                                        //console.log("Manifest Data for file: " + file + " | ", json[0].name + " | " + json[0].version)
                                } catch (err2) {
                                    //console.log("No mod info for file: ", file)
                                }
                            }

                            if (pathObject.ext == '.disabled') {
                                buttonName = 'Load'
                                buttonColor = 'success'
                            }

                            $('#pluginsBox').append(`<li class="list-group-item shadow-sm d-flex flex-column">
                            <p class="mb-1">${pluginName} - <b>${version}</b></p>
                            <div class="d-flex flex-row align-items-center">
                                <small>Modified on</small>
                                <small class="text-info ms-1">${dateFormat(stats.mtime, "dd-mm-yyyy h:MM:ss tt")}</small>
                                <button type="button" class="btn btn-${buttonColor} ms-auto" pluginName="${file}" id="unloadButton">${buttonName}</button>
                                </div>
                            </li>`)
                        })
                    }
                }
            })
        })

        $('#pluginsCount').text(`Installed Plugins: ${files.length}`)
    })
}

function readProperties() {

    propertiesObject = []
    levelName = ''
    $('#serverPropertiesBox').html('')

    var lineReader = readline.createInterface({
        input: fs.createReadStream(`${currentPath}/${currentServerName}/server.properties`)
    })

    lineReader.on('line', function(line) {
        if (line.charAt(0) != "#" && line) {
            var lineSplit = line.split('=')

            $('#serverPropertiesBox').append(`<div class="input-group mt-3">
            <span class="input-group-text" id="${lineSplit[0]}">${lineSplit[0]}</span>
            <input type="text" class="form-control" id="${lineSplit[0]}-inputBox" aria-describedby="${lineSplit[0]}" value="${lineSplit[1]}">
            </div>`)

            if (lineSplit[0] == 'level-name') {
                levelName = lineSplit[1]
                console.log(`Found level name: ${levelName}.`)
            }

            propertiesObject.push({ id: lineSplit[0], value: lineSplit[1] })
        }
    })

    lineReader.on('close', () => {
        sendToast("Finished reading the config.")
    })
}

function saveProperties() {
    var content = ''

    propertiesObject.forEach(function(arrayItem) {
        content += `${arrayItem.id}=` + $(`#${arrayItem.id}-inputBox`).val() + '\r\n'
    })

    fs.writeFile(`${currentPath}/${currentServerName}/server.properties`, content, function(err) {
        if (err) {
            return sendToast("Error saving file: ", err)
        }
        sendToast("Server configuration has been saved.")
    })
}

async function startServer(data) {

    var JVMArguments = $('#jvmArgumentsBox').val().split(' ')

    var serverFileLocation = path.resolve(__dirname, `../${currentPath}/${currentServerName}/${serverFileName}`)

    var args = [`-Xms${data.RAM}G`, `-Xmx${data.RAM}G`]

    if ($("#useArguments").is(':checked') && JVMArguments.length > 0) {
        args = args.concat(JVMArguments)
    }

    args.push('-jar')
    args.push(serverFileLocation)
    args.push('nogui')

    console.log("Starting with: ", data)
    console.log("Arguments: ", args)

    //"C:\\Program Files\\Java\\jdk1.8.0_221\\bin\\java.exe"

    currentProcess = child_process.spawn('java', args, { cwd: path.resolve(__dirname, `../${currentPath}/${currentServerName}`) })

    currentProcess.on('error', (error) => {
        sendToast("There was an error starting the process: " + error)
    })

    currentProcess.stdout.setEncoding('utf8');
    currentProcess.stdout.on('data', (data) => {
        handleConsoleOutput(data, 'stdout')
    })

    currentProcess.stderr.setEncoding('utf8');
    currentProcess.stderr.on('data', (data) => {
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

        //[22:13:34] [Server thread/INFO] [minecraft/PlayerList]: chookstar[/192.168.86.25:1027] logged in with entity id 143 at (103.5, 87.0, -174.5)

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

    $('#serverImport-pathDialogButton').on('click', async function() {
        var dg = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })

        $('#serverInput-pathInputBox').val(dg.filePaths[0])

        console.log(dg)
    })

    $('#serverImport-JARDialogButton').on('click', async function() {
        var dg = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Server File', extensions: ["jar"] }
            ]
        })

        $('#serverInput-JARInputBox').val(dg.filePaths[0])

        console.log(dg)
    })

    //serverImport-JARDialogButton

    $(document).on('click', '#unloadButton', function() {
        var pathObject = path.parse($(this).attr('pluginName'))
        var newPath = null

        if (pathObject.ext == '.disabled') {
            newPath = `${currentPath}/${currentServerName}/mods/${pathObject.base.replace(pathObject.ext, '')}`
            $(this).attr('pluginName', `${pathObject.base.replace(pathObject.ext, '')}`).text('Unload').removeClass('btn-success').addClass('btn-danger')
        } else {
            newPath = `${currentPath}/${currentServerName}/mods/${pathObject.base}.disabled`
            $(this).attr('pluginName', `${pathObject.base}.disabled`).text('Load').removeClass('btn-danger').addClass('btn-success')
        }

        fs.rename(`${currentPath}/${currentServerName}/mods/${pathObject.base}`, newPath, function(err) {
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