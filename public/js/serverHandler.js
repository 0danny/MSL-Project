const fs = require('fs')
const path = require('path')
const readline = require('readline')
const dateFormat = require('dateformat')
const archive = require('ls-archive')
const { sendToast } = require('js/helper')
const pathHandlerObj = require('./pathHandler')
const { getServerData } = require('js/settingsParser')

var propertiesObject = []
var levelName = null

function initServerHandler() {
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

        pathHandlerObj.currentServerName = $(this).attr('serverName')

        pathHandlerObj.serverFileName = getServerData(pathHandlerObj.currentServerName).serverFileName

        //findVersion()
        readProperties()
        searchPlugins()
    })

    refreshServers()
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
        sendToast("Server's folder does not exist, cannot continue.")
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

    if (fs.existsSync(`${pathHandlerObj.getServerPath()}/plugins`)) {
        folderPath = `${pathHandlerObj.getServerPath()}/plugins`
    } else if (fs.existsSync(`${pathHandlerObj.getServerPath()}/mods`)) {
        folderPath = `${pathHandlerObj.getServerPath()}/mods`
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
        input: fs.createReadStream(`${pathHandlerObj.getServerPath()}/server.properties`)
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

    fs.writeFile(`${pathHandlerObj.getServerPath()}/server.properties`, content, function(err) {
        if (err) {
            return sendToast("Error saving file: ", err)
        }
        sendToast("Server configuration has been saved.")
    })
}

module.exports = { refreshServers, initServerHandler }