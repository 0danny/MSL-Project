const path = require('path')
const remote = require('electron').remote

class PathHandler {
    constructor() {
        this.debugMode = true

        this.currentPath = this.debugMode ? 'servers' : `${path.dirname(remote.app.getPath("exe"))}/servers`
        this.currentServerName = null
        this.serverFileName = null
    }

    getWorkingDirectory() {
        return this.debugMode ? __dirname : path.dirname(remote.app.getPath("exe"))
    }

    getServerPath() {
        return `${this.currentPath}/${this.currentServerName}`
    }

    getServerFilePath() {
        return this.debugMode ? path.resolve(__dirname, `../../servers/${this.currentServerName}/${this.serverFileName}`) : `${this.currentPath}/${this.currentServerName}/${this.serverFileName}`
    }
}

var pathHandlerObj = new PathHandler()

module.exports = pathHandlerObj