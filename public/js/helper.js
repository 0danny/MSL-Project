const { resolve } = require('path');
const { readdir } = require('fs').promises
const jsDownloader = require('nodejs-file-downloader')

function sendToast(text) {
    var toastLive = document.getElementById('liveToast')
    var toast = new bootstrap.Toast(toastLive)

    $('.toast-body').html(text)

    toast.show()
}

async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(dirents.map((dirent) => {
        const res = resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFiles(res) : res
    }))
    return Array.prototype.concat(...files);
}

var currentTheme = 'light'

function toggleCSS(mode) {
    const toggleDark = () => {
        $('body').addClass('bg-dark')
        $('#main-container').addClass('bg-dark')
        $('html').removeClass('light').addClass('dark')
    }

    const toggleLight = () => {
        $('body').removeClass('bg-dark')
        $('#main-container').removeClass('bg-dark')
        $('html').removeClass('dark').addClass('light')
    }

    if (mode != undefined) {
        switch (mode) {
            case 'dark':
                toggleDark()
                break
            case 'light':
                toggleLight()
                break
        }
        currentTheme = mode
    } else {
        switch (currentTheme) {
            case 'light':
                toggleDark()
                currentTheme = 'dark'
                break
            case 'dark':
                toggleLight()
                currentTheme = 'light'
                break;
        }
    }

    console.log("Current Mode: ", currentTheme)
}


async function downloadFile(path, fileName, url, progress) {
    return new Promise(async(resolve, reject) => {
        const downloader = new jsDownloader({
            url: url,
            fileName: fileName,
            directory: path,
            onProgress: function(percentage, chunk, remainingSize) {
                progress(percentage)
            }
        })

        try {
            await downloader.download();

            resolve()
        } catch (error) {
            console.log('Error downloading the file...', error)
            reject(error)
        }
    })
}

function getCurrentTheme() {
    return currentTheme
}

module.exports = { sendToast, getFiles, toggleCSS, getCurrentTheme, downloadFile }