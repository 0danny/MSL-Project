require('app-module-path').addPath(__dirname);


//imports
const { ipcRenderer } = require('electron')
const child_process = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const dateFormat = require('dateformat');
const archive = require('ls-archive')
const { readSettings, writeSettings } = require('js/settingsParser.js')
const { sendToast } = require('js/helper')

$(function() {
    beginFlow()

    findVersion()
    readProperties()
    readSettings()
    searchMods()
})

var javaPID = null
var levelName = null
var currentProcess = null
var currentPath = 'renderer/valhelsia-server'
var serverFileName = 'forge-1.16.5-36.2.2.jar'
var propertiesObject = []
var players = []

function findVersion() {
    archive.readFile(`${currentPath}/${serverFileName}`, path.normalize("version.json"), function(err, manifestData) {
        if (!err) {
            var json = JSON.parse(manifestData.toString())

            $('#gameVersion').html(`Game version is: <b>${json.name}<b>`)
        } else {
            $('#gameVersion').html(`Game version is: <b>${path.parse(serverFileName).name}<b>`)
        }
    })
}

async function searchMods() {
    fs.readdir(`${currentPath}/mods`, async(err, files) => {
        if (files == undefined) {
            return
        }

        files.forEach(file => {

            var filePath = `${currentPath}/mods/${file}`

            fs.stat(filePath, async(err, stats) => {
                if (err) {
                    console.log(`Error reading mode: ${file}.`)
                    throw err;
                }

                if (!stats.isDirectory()) {
                    var pathObject = path.parse(file)
                    var buttonName = 'Unload'
                    var buttonColor = 'danger'
                    var modName = pathObject.name
                    var version = Math.round(stats.size / 1024) + "Kb"

                    if (file.includes('.jar') || file.includes('.zip')) {

                        archive.readFile(filePath, path.normalize("mcmod.info"), function(err, manifestData) {
                            if (!err) {
                                var json = JSON.parse(manifestData.toString())

                                try {
                                    modName = json[0].name
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

                            $('#modsBox').append(`<li class="list-group-item shadow-sm d-flex flex-column">
                            <p class="mb-1">${modName} - <b>${version}</b></p>
                            <div class="d-flex flex-row align-items-center">
                                <small>Modified on</small>
                                <small class="text-info ms-1">${dateFormat(stats.mtime, "dd-mm-yyyy h:MM:ss tt")}</small>
                                <button type="button" class="btn btn-${buttonColor} ms-auto" modName="${file}" id="unloadButton">${buttonName}</button>
                                </div>
                            </li>`)

                            $('#modsCount').text(`Installed Mods: ${files.length}`)
                        })
                    }
                }
            })
        })
    })
}

function readProperties() {
    var lineReader = readline.createInterface({
        input: fs.createReadStream(currentPath + '/server.properties')
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
        //console.log("Prop Lines: ", line)
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

    fs.writeFile(currentPath + '/server.properties', content, function(err) {
        if (err) {
            return sendToast("Error saving file: ", err)
        }
        sendToast("Server configuration has been saved.")
    })
}

async function startServer(data) {

    var JVMArguments = $('#jvmArgumentsBox').val().split(' ')

    var serverFileLocation = path.resolve(__dirname, `../${currentPath}/${serverFileName}`)

    var args = [`-Xms${data.RAM}G`, `-Xmx${data.RAM}G`]

    if ($("#useArguments").is(':checked') && JVMArguments.length > 0) {
        args = args.concat(JVMArguments)
    }

    args.push('-jar')
    args.push(serverFileLocation)
    args.push('nogui')

    console.log("Starting with: ", data)
    console.log("Arguments: ", args)

    currentProcess = child_process.spawn("C:\\Program Files\\Java\\jdk1.8.0_221\\bin\\java.exe", args, { cwd: path.resolve(__dirname, `../${currentPath}`) })

    currentProcess.on('error', (error) => {
        sendToast("There was an error starting the process: " + error)
    })

    currentProcess.stdout.setEncoding('utf8');
    currentProcess.stdout.on('data', (data) => {
        console.log(data)
        handleConsoleOutput(data, 'stdout')
    })

    currentProcess.stderr.setEncoding('utf8');
    currentProcess.stderr.on('data', (data) => {
        console.log(data)
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

    if (currentProcess != null && javaPID != null) {
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

    $('#unloadButton').on('click', function() {
        console.log("Clicked")
        console.log("Found Mode: " + $(this).attr('modName'))
    })

    $(document).on('click', '#unloadButton', function() {
        var pathObject = path.parse($(this).attr('modName'))
        var newPath = null

        if (pathObject.ext == '.disabled') {
            newPath = `${currentPath}/mods/${pathObject.base.replace(pathObject.ext, '')}`
            $(this).attr('modName', `${pathObject.base.replace(pathObject.ext, '')}`).text('Unload').removeClass('btn-success').addClass('btn-danger')
        } else {
            newPath = `${currentPath}/mods/${pathObject.base}.disabled`
            $(this).attr('modName', `${pathObject.base}.disabled`).text('Load').removeClass('btn-danger').addClass('btn-success')
        }

        fs.rename(`${currentPath}/mods/${pathObject.base}`, newPath, function(err) {
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