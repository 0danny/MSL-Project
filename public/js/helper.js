const { resolve } = require('path');
const { readdir } = require('fs').promises;

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

module.exports = { sendToast, getFiles }