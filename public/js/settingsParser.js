const fs = require('fs')
const { sendToast } = require('js/helper.js')
const pathHandlerObj = require('js/pathHandler')

var settingsPath = 'settings.json'

var settingsObject = [
    { name: 'Server Data', serverData: [] },
    { name: 'JVM Arguments', data: '', target: '#jvmArgumentsBox' }
]

function readSettings() {
    sendToast("Reading settings...")

    fs.access(settingsPath, fs.constants.F_OK, (err) => {
        if (err) {
            writeSettings()
            sendToast("Config file does not exist, creating...")
        } else {
            fs.readFile(settingsPath, (err, data) => {
                if (err) {
                    sendToast("There was an error reading the settings file...")
                }

                settingsObject = JSON.parse(data)

                console.log("Got config file contents: ", JSON.parse(data))

                applySettings()
            })
        }
    })
}

function loopData(callback) {
    settingsObject.forEach(function(setting) {
        if (setting.target != undefined) {
            callback(setting)
        }
    })
}

function addServerData(object) {
    settingsObject[0].serverData.push(object)
}

function applySettings() {
    loopData((setting) => {
        switch ($(setting.target).prop('nodeName')) {
            case 'INPUT':
                $(setting.target).val(setting.data)
                break;
        }
    })
}

function writeSettings() {
    console.log("Writing the settings file.")

    loopData((setting) => {
        switch ($(setting.target).prop('nodeName')) {
            case 'INPUT':
                setting.data = $(setting.target).val()
                break;
        }
    })

    console.log('Before Write: ', settingsObject)

    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settingsObject), { encoding: "utf8" })
    } catch (err) {
        sendToast("There was an error writing the settings file...")
    }
}

function getServerData(name) {
    var array = settingsObject[0].serverData.filter(element => element.serverName == name)

    if (array.length <= 0) {
        throw err
    } else {
        return array[0]
    }
}

module.exports = { readSettings, writeSettings, addServerData, getServerData }