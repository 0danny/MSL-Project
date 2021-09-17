require('app-module-path').addPath(__dirname);

//imports
const { readSettings, writeSettings } = require('js/settingsParser')
const { initImportHandler } = require('js/importHandler')
const { initServerHandler } = require('js/serverHandler')
const { initServerCreator } = require('js/serverCreator')
const pathHandlerObj = require('js/pathHandler')
const { toggleCSS } = require('js/helper')

var currentWindow = require('electron').remote.getCurrentWindow()

$(function() {
    console.log("[MSL] Project has begun Initialization: ", pathHandlerObj.getWorkingDirectory())

    //Display current MSL Version
    fetchVersion()

    //Init the handlers and register events
    initImportHandler()
    initServerHandler()
    initServerCreator()

    //Read MSL Settings
    readSettings()

    $('#toggleThemeButton').on('click', function() {
        toggleCSS()

        writeSettings()
    })

    $('#minimizeButton').on('click', function() {
        currentWindow.minimize()
    })
    $('#exitButton').on('click', function() {
        currentWindow.close()
    })
})

var MSLVersion = "0.1"

function fetchVersion() {
    $('#MSLVersion').html(`MSL Version: <b>V${MSLVersion}</b> | Developer: <b>DannyOCE</b>`)
}