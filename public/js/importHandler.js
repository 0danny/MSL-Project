const fs = require('fs').promises
const { remote } = require('electron')
const dialog = remote.dialog;
const fse = require('fs-extra')
const { sendToast, getFiles } = require('js/helper')
const pathHandlerObj = require('js/pathHandler')
const { writeSettings, addServerData } = require('js/settingsParser')
const { refreshServers } = require('js/serverHandler')
const path = require('path')

function clearImportModal() {
    $('#serverInput-pathInputBox').val('')
    $('#serverInput-NameInputBox').val('')
    $('#serverInput-JARFiles').html('')
    $('serverInput-ProgressBar').css('width', '0%')
}

function initImportHandler() {
    $('#serverImport-pathDialogButton').on('click', async function() {
        var dg = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })

        $('#serverInput-pathInputBox').val(dg.filePaths[0])

        $('#serverInput-JARFiles').html('')

        fs.readdir(dg.filePaths[0], function(err, files) {
            const jarFiles = files.filter(el => path.extname(el) === '.jar')

            jarFiles.forEach(function(file) {
                $('#serverInput-JARFiles').append(`<div class="form-check form-check-inline">
                <input class="form-check-input" name="serverInput-Radios" type="radio" id="serverInput-Radio-${file}" value="${file}">
                <label class="form-check-label" for="serverInput-Radio-${file}">${file}</label>
                </div>`)
            })
        })
    })

    $('#serverImport-ImportButton').on('click', function() {
        importServer(
            $('#serverInput-pathInputBox').val(),
            $('input[name="serverInput-Radios"]:checked').val(),
            $('#serverInput-NameInputBox').val()
        )
    })

    $('#serverCreatorModal').on('hidden.bs.modal', function(e) {
        console.log("Closing")

        clearImportModal()
    })
}

function importServer(serverFolderPath, serverFileName, serverName) {

    console.log(`Importing with settings: `, { folderPath: serverFolderPath, fileName: serverFileName, serverName: serverName })

    getFiles(serverFolderPath)
        .then(files => {
            var progress = 0

            console.log(`Copying from ${serverFolderPath} to ${pathHandlerObj.currentPath}`)

            fse.copy(serverFolderPath, `${pathHandlerObj.currentPath}/${serverName}`, {
                    filter: function(src, dest) {

                        //----------------------------------------------------
                        // This is a very hacky and probably slow solution to making a progress bar, since fs-extra
                        // doesn't actually expose any callbacks or variables for statistics regarding copy progress
                        progress++

                        var percentage = 0

                        if (progress < files.length) {
                            percentage = (progress / files.length) * 100
                        } else if (progress >= files.length) {
                            percentage = 100
                        }
                        //----------------------------------------------------

                        $('#serverInput-ProgressBar').css('width', `${progress}%`)

                        console.log(`Progress: ${progress}/${files.length}`)

                        return true
                    }
                })
                .then(() => {
                    addServerData({ serverName: serverName, serverFileName: serverFileName })
                    writeSettings()

                    refreshServers()

                    sendToast(`Server has been imported as: <b>${serverName}</b>.`)

                    $('#serverImportModal').modal('hide')
                    clearImportModal()
                })
                .catch(err => console.log("There was an error importing the server: ", err))
        })
        .catch(e => console.error('There was an error retrieving the files from the dir: ', e))

    return
}

module.exports = { initImportHandler }