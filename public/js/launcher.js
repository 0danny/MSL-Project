require('app-module-path').addPath(__dirname);

//imports
const { readSettings } = require('js/settingsParser')
const { initImportHandler } = require('js/importHandler')
const { initServerHandler } = require('js/serverHandler')
const { initServerCreator } = require('js/serverCreator')
const pathHandlerObj = require('js/pathHandler')

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
})

var MSLVersion = "0.1"

function fetchVersion() {
    $('#MSLVersion').html(`MSL Version: <b>V${MSLVersion}</b> | Developer: <b>DannyOCE</b>`)
}