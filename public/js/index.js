const electron = require('electron')
const child_process = require('child_process')
var exec = child_process.exec
const process = require('process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const find = require('find-process')
const dateFormat = require('dateformat');
const archive = require('ls-archive')

$(function() {
    beginFlow()

    findVersion()
    readConfig()
    searchMods()
})

var currentProcess = null
var currentPath = 'renderer/vanilla-server'
var configObject = []
var javaPID = null
var serverFileName = 'spigot.jar'
var levelName = null

function findVersion() {
    archive.readFile(`${currentPath}/${serverFileName}`, path.normalize("version.json"), function(err, manifestData) {
        if (!err) {
            var json = JSON.parse(manifestData.toString())

            $('#gameVersion').html(`Game version is: <b>${json.name}<b>`)
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

function sendToast(text) {
    var toastLive = document.getElementById('liveToast')
    var toast = new bootstrap.Toast(toastLive)

    $('.toast-body').text(text)

    toast.show()
}

function readConfig() {
    var lineReader = readline.createInterface({
        input: fs.createReadStream(currentPath + '/server.properties')
    })

    lineReader.on('line', function(line) {
        if (line.charAt(0) != "#" && line) {
            var lineSplit = line.split('=')

            $('#serverConfigBox').append(`<div class="input-group mt-3">
            <span class="input-group-text" id="${lineSplit[0]}">${lineSplit[0]}</span>
            <input type="text" class="form-control" id="${lineSplit[0]}-inputBox" aria-describedby="${lineSplit[0]}" value="${lineSplit[1]}">
            </div>`)

            if (lineSplit[0] == 'level-name') {
                levelName = lineSplit[1]
                console.log(`Found level name: ${levelName}.`)
            }

            configObject.push({ id: lineSplit[0], value: lineSplit[1] })
        }
        //console.log("Prop Lines: ", line)
    })

    lineReader.on('close', () => {
        sendToast("Finished reading the config.")
    })
}

function saveConfig() {
    var content = ''

    configObject.forEach(function(arrayItem) {
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

    var args = [
        `cd ${currentPath}`,
        `java -Xms${data.RAM}G -Xmx${data.RAM}G -jar ${serverFileName} nogui`
    ]

    console.log("Starting with: ", data)

    command = ["/c", args.join('&')]

    currentProcess = child_process.spawn('cmd.exe', command)

    await getChildProcess()

    currentProcess.on('error', (error) => {
        sendToast("There was an error starting the process.")
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

    if (data.includes("logged in with entity id")) {
        parsePlayer(data)
    }

    $(`#pills-normal`).append(`<li class="list-group-item">${data}</li>`)

    $(`#pills-normal`).stop().animate({ scrollTop: $(`#pills-normal`)[0].scrollHeight }, 500)
}

function parsePlayer(data) {
    var regex = /^\[(.*?)\]\s\[(.*?)\]:\s(.*?)\[(.*?)\] logged in with entity id (.*?) at \(\[(.*?)\](.*?)\)/g

    var match = regex.exec(data.trim())

    console.log("Original player data: ", data)
    console.log("Matches for player: ", match)

    var IPSplit = match[4].split(':')

    $('#playersBox').append(`<li class="list-group-item shadow-sm d-flex flex-column">
        <div class="d-flex flex-row align-items-center">
            <medium><b>${match[3]}</b></medium>
            <div class="fs-5 ms-auto text-primary">${match[5]}</div>
        </div>
        <small>Last saved coordinates: <font color="red">(${match[7]})</font></small>
        <small>IP Address & Port: <font color="orange">${IPSplit[0].slice(1)} | ${IPSplit[1]}</font></small>
        <small>Logged in at: <font color="green">${match[1]}</font></small></li>`)

    sendToast("A new player joined: " + match[3])
}

function parseConsoleOutput(data) {
    var regex = /^(\d\d\d\d-\d\d-\d\d)\s([0-9][0-9]:[0-9][0-9]:[0-9][0-9])\s\[(.*?)\]\s\[(.*?)\]\s(.+)/g //An even worse regex statement 

    var match = regex.exec(data)

    return { date: match[1], time: match[2], type: match[3], origin: match[4], data: match[5] }
}

async function getChildProcess() {

    find('name', 'java', true)
        .then(function(list) {
            if (list.length != 0) {
                for (var i = 0; i < list.length; i++) {
                    if (list[0].ppid == currentProcess.pid) {
                        javaPID = list[0].ppid

                        sendToast(`Found server process pid: ${javaPID}`)
                    }
                }
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

    $('#unloadButton').on('click', function() {
        console.log("Clicked")
        console.log("Found Mode: " + $(this).attr('modName'))
    })

    $(document).on('click', '#unloadButton', function() {
        var pathObject = path.parse($(this).attr('modName'))

        if (pathObject.ext == '.disabled') {

            fs.rename(`${currentPath}/mods/${pathObject.base}`, `${currentPath}/mods/${pathObject.base.replace(pathObject.ext, '')}`, function(err) {
                if (err) console.log('ERROR: ' + err)
            })

            $(this).attr('modName', `${pathObject.base.replace(pathObject.ext, '')}`).text('Unload').removeClass('btn-success').addClass('btn-danger')
        } else {
            fs.rename(`${currentPath}/mods/${pathObject.base}`, `${currentPath}/mods/${pathObject.base}.disabled`, function(err) {
                if (err) console.log('ERROR: ' + err)
            })

            $(this).attr('modName', `${pathObject.base}.disabled`).text('Load').removeClass('btn-danger').addClass('btn-success')
        }
    })

    $('#sendMessageButton').on('click', function() {
        sendMessage($('#messageInput').val())
    })

    $('#saveButton').on('click', function() {
        sendMessage('save-all')
    })

    $('#saveConfigButton').on('click', function() {
        sendToast("Saving server configuration...")
        saveConfig()
    })

    $('#messageInput').on('keypress', function(e) {
        if (e.which === 13) { //Have to fix this deprecated bullshit
            $('#sendMessageButton').trigger()
        }
    });

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