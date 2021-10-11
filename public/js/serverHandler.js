const fs = require('fs')
const path = require('path')
const readline = require('readline')
const dateFormat = require('dateformat')
const archive = require('ls-archive')
const { ipcRenderer } = require('electron')
const { sendToast, downloadFile } = require('js/helper')
const pathHandlerObj = require('./pathHandler')
const { getServerData } = require('js/settingsParser')
const child_process = require('child_process')
const axios = require('axios');

var propertiesObject = []
var players = []
var currentProcess = null
var currentServerAddress = null

function initServerHandler() {
    $(document).on('click', '#serverPickerButton', function() {

        switch ($(this).text()) {
            case 'New Server':
                new bootstrap.Modal(document.getElementById('serverCreatorModal')).show()
                    //TODO
                return
            case 'Import Server':
                new bootstrap.Modal(document.getElementById('serverImportModal')).show()
                return
        }

        if (!currentProcess) {
            $('#currentServerText').text($(this).attr('serverName'))

            pathHandlerObj.currentServerName = $(this).attr('serverName')

            pathHandlerObj.serverFileName = getServerData(pathHandlerObj.currentServerName).serverFileName

            $('#playersBox').html('')
            $('#playersConnected').html(`<b>0</b> Players Connected`)
            players = []

            findVersion()
            readProperties().then(() => {
                searchPlugins()
            })
        } else {
            sendToast('Cannot change servers while one is running.')
        }
    })

    //TODO: Needs refactoring / pisses me off looking at this
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

    $('#forceQuitButton').on('click', function() {
        safelyForceQuit()
    })

    $('#server-ip-show-hide').on('click', function() {
        if ($(this).text() == 'Show') {
            $('#server-ip-inputBox').css('color', '')
            $(this).text('Hide')
        } else {
            $('#server-ip-inputBox').css('color', 'transparent')
            $(this).text('Show')
        }

    })

    $('#messageInput').on('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage($('#messageInput').val())
            $('#messageInput').val('')
        }
    })

    $('#startServerButton').on('click', function() {
        if (pathHandlerObj.currentServerName != null) {
            if ($('#startServerButton').text() == "Stop Server") {
                sendMessage('stop')

                preCloseClean()

                $('#startServerButton').text('Start Server')
            } else {
                startServer({ RAM: $('#ram-inputBox').val(), PERM: $('#permSize-inputBox').val() })

                $('#startServerButton').text('Stop Server')
            }
        } else {
            sendToast('No server is selected.')
        }
    })

    $('#plugin-downloader-installbutton').on('click', function() {
        if (pathHandlerObj.currentServerName != null) {

            var checkedBoxes = $('input[id="plugin-downloader-check"]:checked')

            var progressValue = 0

            $.each(checkedBoxes, async function() {
                await downloadFile(`${pathHandlerObj.getServerPath()}/plugins`, '', $(this).val().toString(), function(progress) {}).then(function() {
                    progressValue += 1

                    console.log(`{${progressValue}} [Plugin Downloader]: File has been downloaded.`)

                    $('#plugin-downloader-progressbar').css('width', `${(progressValue / checkedBoxes.length) * 100}%`)

                    if (progressValue == checkedBoxes.length) {
                        $('#plugin-downloader-progressbar').css('width', `0%`)
                        sendToast(`<b>${checkedBoxes.length}</b> plugins have been downloaded and installed.`)
                        searchPlugins()
                    }
                }).catch(err => console.log("Error downloading file: ", err))
            })
        }
    })

    ipcRenderer.on('close', () => {
        safelyForceQuit()
    })

    initPluginDownloader()
    refreshServers()
    fetchIPAddress()
}

function fetchIPAddress() {

    axios.get('http://bot.whatismyipaddress.com/')
        .then(function(response) {
            console.log(`Found Server IP Address: ${response.data}`)

            $('#server-ip-inputBox').val(response.data)
            currentServerAddress = response.data
        })
        .catch(function(error) {
            console.log('Could not fetch IP: ', error);
            currentServerAddress = null
        })
}

function initPluginDownloader() {

    axios.get('https://api.github.com/repos/EssentialsX/Essentials/releases')
        .then(function(response) {

            response.data[0].assets.forEach(function(element) {
                $('#plugin-downloader-accordion').append(`<li class="list-group-item">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${element.browser_download_url}" id="plugin-downloader-check">
                        <label class="form-check-label" for="plugin-downloader-check">${path.parse(element.name).name}</label>
                    </div>
                </li>`)
            })
        })
        .catch(function(error) {
            console.log(`Error initiating plugin downloader, ${error}`);
        })
}

async function startServer(data) {

    var JVMArguments = $('#jvmArgumentsBox').val().split(' ')

    var args = [`-Xms${data.RAM}G`, `-Xmx${data.RAM}G`]

    if ($("#useArguments").is(':checked') && JVMArguments.length > 0) {
        args = args.concat(JVMArguments)
    }

    if ($('#usePermSize').is(':checked')) {
        args.push(`-XX:PermSize=${$('#permSize-inputBox').val()}M`)
    }

    args.push('-jar')
    args.push(pathHandlerObj.getServerFilePath())
    args.push('nogui')

    console.log("Starting with: ", data)
    console.log("Arguments: ", args)

    //"C:\\Program Files\\Java\\jdk1.8.0_221\\bin\\java.exe" //Alt java version

    currentProcess = child_process.spawn("C:\\Program Files\\Java\\jdk1.8.0_221\\bin\\java.exe", args, { cwd: pathHandlerObj.getServerPath() })

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

        $("#serverStatus").text('Off')
        $("#serverStatus").removeClass('text-success')
        $("#serverStatus").addClass('text-danger')

        $('#pills-normal').html('')
        $('#pills-error').html('')

        preCloseClean()
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

    if (data.includes('For help, type \"help\"')) {
        $("#serverStatus").text('Running')
        $("#serverStatus").removeClass('text-danger')
        $("#serverStatus").addClass('text-success')

        readProperties()
    }

    $(`#pills-normal`).append(`<li class="list-group-item">${data}</li>`)

    $(`#pills-normal`).stop().animate({ scrollTop: $(`#pills-normal`)[0].scrollHeight }, 500)
}

function safelyForceQuit() {
    sendToast("Attempting to force quit server...")
    writeSettings()

    if (currentProcess != null) {
        sendMessage('save-all')
        $('#messageInput').val('')
        $('#pills-normal').html('')
        $('#pills-error').html('')
        currentProcess.stdin.end()
        currentProcess.kill()
        $('#startServerButton').text('Start Server')
    }
}

class playerManager {

    constructor(playerName, status, coordinates, networkAddress, loginTime) {
        this.playerName = playerName
        this.status = status
        this.coordinates = coordinates
        this.networkAddress = networkAddress
        this.loginTime = loginTime
    }

    updatePlayer() {
        $(`#${this.playerName}-playerobject-status`)
            .text(this.status)
            .removeClass('text-success')
            .removeClass('text-danger')
            .addClass(`text-${this.returnColor()}`)
    }

    returnColor() {
        var color = 'danger'

        switch (this.status) {
            case 'Online':
                color = 'success'
                break
            case 'Offline':
                color = 'danger'
                break
        }

        return color
    }

    returnTemplate() {
        return `<li class="list-group-item shadow-sm d-flex flex-column" id="${this.playerName}-playerobject">
            <div class="d-flex flex-row align-items-center">
                <medium><b>${this.playerName}</b></medium>
                <div class="fs-5 ms-auto text-${this.returnColor()}" id="${this.playerName}-playerobject-status">${this.status}</div>
            </div>
            <small>Last saved coordinates: <font color="red" id="${this.playerName}-playerobject-coords">(${this.coordinates})</font></small>
            <small>IP Address & Port: <font color="orange" id="${this.playerName}-playerobject-ip">${this.networkAddress.IP} | ${this.networkAddress.PORT}</font></small>
            <small>Logged in at: <font color="green" id="${this.playerName}-playerobject-time">${this.loginTime}</font></small>

            <div class="d-flex flex-row pt-2">
                <button class="btn btn-danger w-100 me-1" type="button" id="banButton" playerName="${this.playerName}">Ban</button>
                <button class="btn btn-warning w-100 me-1" type="button" id="kickButton" playerName="${this.playerName}">Kick</button>
                <button class="btn btn-success w-100 me-1" type="button" id="giveOPButton" playerName="${this.playerName}">Give OP</button>
                <button class="btn btn-danger w-100" type="button" id="removeOPButton" playerName="${this.playerName}">Remove OP</button>
            </div>
        </li>`
    }
}

function parsePlayer(data) {

    if (data.includes('left the game')) {
        var match = /^\[(.*?)\]\s\[(.*?)\]:\s(.*?)\sleft the game/gm.exec(data.trim())

        var playerObject = players[players.findIndex(i => i.playerName === match[3])]

        sendToast(`${playerObject.playerName} has left the game.`)

        playerObject.status = 'Offline'
        playerObject.updatePlayer()

    } else {

        var match = /^\[(.*?)\]\s(.+?):\s(.*?)\[(.*?)\] logged in with entity id (.*?) at \((.*?)\)/gm.exec(data.trim())

        var IPSplit = match[4].split(':')

        var playerSearch = players[players.findIndex(i => i.playerName === match[3])]

        if (playerSearch != undefined) {
            playerSearch.status = 'Online'
            playerSearch.updatePlayer()

        } else {
            var playerObject = new playerManager(match[3], 'Online', match[6], { IP: IPSplit[0].slice(1), PORT: IPSplit[1] }, match[1])

            sendToast(`Player connected <b>${playerObject.playerName}</b>`)

            players.push(playerObject)

            $('#playersBox').append(playerObject.returnTemplate())
        }
    }

    $('#playersConnected').html(`<b>${players.filter(element => element.status === 'Online').length}</b> Players Connected`)
}

function sendMessage(msg) {
    if (currentProcess != null) {
        currentProcess.stdin.write(`${msg}\n`);
    }
}

function preCloseClean() {
    try {
        currentProcess.stdin.end()
        currentProcess = null
    } catch (err) {
        console.log('[Process] Error during clean: ', err)
    }
}

function refreshServers() {
    $('#serverPickerButton[serverName]').each(function() {
        $(this).remove()
    })

    if (fs.existsSync(pathHandlerObj.currentPath)) {

        fs.readdir(pathHandlerObj.currentPath, async(err, files) => {

            if (files == undefined || files.length <= 0) {
                console.log("No servers installed.")
                return
            }

            files.forEach(file => {

                fs.stat(`${pathHandlerObj.currentPath}/${file}`, async(err, stats) => {
                    if (err) {
                        console.log(`Error reading mode: ${file}.`)
                        throw err
                    }

                    if (stats.isDirectory()) {
                        $('#serverDropDown').append(`<li><a class="dropdown-item" id="serverPickerButton" href="#" serverName="${file}">${file}</a></li>`)
                    }
                })
            })
        })
    } else {
        sendToast("Server's folder does not exist, creating...")

        try {
            fs.mkdirSync(`${pathHandlerObj.getWorkingDirectory()}/servers`)
        } catch (err) {
            console.log("Could not create servers folder: ", err)
        }
    }
}

function findVersion() {
    archive.readFile(pathHandlerObj.getServerFilePath(), path.normalize("version.json"), function(err, manifestData) {
        if (!err) {
            var json = JSON.parse(manifestData.toString())

            if (json.name != undefined) {
                $('#gameVersion').html(`Game version is: <b>${json.name}<b>`)
            } else {
                fallback()
            }
        } else {
            fallback()
        }
    })

    const fallback = () => {
        $('#gameVersion').html(`Game version is: <b>${path.parse(pathHandlerObj.serverFileName).name}<b>`)
    }
}

async function searchPlugins() {

    //Needs re-fractoring very badly.

    $('#pluginsBox').html('')
    $('#pluginsCount').text(`Installed Plugins: 0`)

    var folderPath = null

    var serverPath = pathHandlerObj.getServerPath()
    if (fs.existsSync(`${serverPath}/plugins`)) {
        folderPath = `${serverPath}/plugins`
    } else if (fs.existsSync(`${serverPath}/mods`)) {
        folderPath = `${serverPath}/mods`
    } else {
        $('#pills-plugins-tab').parent().css('display', 'none')
        return
    }

    console.log('Looking for mods within: ', folderPath)

    await fs.promises.readdir(folderPath, async(err, files) => {

        files = files.filter(element => element.includes('.jar') || element.includes('.zip'))

        /*
        if (files == undefined || files.length <= 0) {
            $('#pills-plugins-tab').parent().css('display', 'none')
            console.log("No plugins installed.")
            return
        } else {
            $('#pills-plugins-tab').parent().css('display', 'block')
        }*/

        files.forEach(async function(file) {

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
                                try {
                                    pluginName = /"name".+"(.*?)"/g.exec(manifestData.toString())[1]
                                    version += ` | ${/"version".+"(.*?)"/g.exec(manifestData.toString())[1]}`
                                } catch (err) {
                                    console.log({ Error: 'parsing JSON - mcmod.info', Stack: err, Data: manifestData.toString(), File: file })
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
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(`${pathHandlerObj.getServerPath()}/server.properties`)) {
            resolve()
            return
        }

        propertiesObject = []
        $('#serverPropertiesBox').html('')

        var lineReader = readline.createInterface({
            input: fs.createReadStream(`${pathHandlerObj.getServerPath()}/server.properties`)
        })

        lineReader.on('line', function(line) {
            if (line.charAt(0) != "#" && line) {
                var lineSplit = line.split('=')

                $('#serverPropertiesBox').append(`<div class="input-group mt-3">
                <span class="input-group-text" id="${lineSplit[0]}">${lineSplit[0]}</span>
                <input type="text" class="form-control" id="${lineSplit[0]}-inputBox" aria-describedby="${lineSplit[0]}" value="${lineSplit[1]}">
                </div>`)

                if (lineSplit[0] == 'server-port' && currentServerAddress != null) {
                    $('#server-ip-inputBox').val(`${currentServerAddress}:${lineSplit[1]}`)
                }

                propertiesObject.push({ id: lineSplit[0], value: lineSplit[1] })
            }
        })

        lineReader.on('close', () => {
            sendToast("Finished reading the config.")
            resolve()
        })
    })
}

function saveProperties() {
    var content = ''

    propertiesObject.forEach(function(arrayItem) {
        content += `${arrayItem.id}=` + $(`#${arrayItem.id}-inputBox`).val() + '\r\n'
    })

    fs.writeFile(`${pathHandlerObj.getServerPath()}/server.properties`, content, function(err) {
        if (err) {
            return sendToast("Error saving file: ", err)
        }
        sendToast("Server configuration has been saved.")
    })
}

module.exports = { refreshServers, initServerHandler }