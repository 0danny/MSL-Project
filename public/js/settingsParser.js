const fs = require('fs')
const { sendToast, toggleCSS, getCurrentTheme } = require('js/helper.js')
const pathHandlerObj = require('js/pathHandler')

var settingsPath = 'settings.json'

var settingsObject = {
    serverData: [],
    themeData: 'dark',
    settingsData: [
        { name: 'JVM Arguments', data: '', target: '#jvmArgumentsBox' },
        { name: 'Use JVM Arguments', data: '', target: '#useArguments' },
        { name: 'Allocated RAM', data: '', target: '#ram-inputBox' }
    ]
}

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

                jQuery.extend(true, settingsObject, JSON.parse(data)) //Modifies original instance of settingsObject

                console.log("Got config file contents: ", settingsObject)

                applySettings()
            })
        }
    })

    $('#settings-forceSaveButton').on('click', function() {
        writeSettings()
    })
}

function loopData(callback) {
    settingsObject.settingsData.forEach(function(setting) {
        callback(setting)
    })
}

function addServerData(object) {
    settingsObject.serverData.push(object)
}

function applySettings() {
    loopData((setting) => {
        switch ($(setting.target).attr('type')) {
            case 'text':
                $(setting.target).val(setting.data)
                break
            case 'checkbox':
                $(setting.target).prop('checked', setting.data);
                break
        }
    })

    toggleCSS(settingsObject.themeData)
}

function writeSettings() {
    console.log("Writing the settings file.")

    console.log(settingsObject)

    loopData((setting) => {
        switch ($(setting.target).attr('type')) {
            case 'text':
                setting.data = $(setting.target).val()
                break
            case 'checkbox':
                setting.data = $(setting.target).is(':checked')
                break
        }
    })

    console.log(`Theme before write: ${getCurrentTheme()}`)

    settingsObject.themeData = getCurrentTheme()

    console.log('Before Write: ', settingsObject)

    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settingsObject), { encoding: "utf8" })
    } catch (err) {
        sendToast("There was an error writing the settings file...")
    }
}

function getServerData(name) {
    var array = settingsObject.serverData.filter(element => element.serverName == name)

    if (array.length <= 0) {
        throw err
    } else {
        return array[0]
    }
}

module.exports = { readSettings, writeSettings, addServerData, getServerData }