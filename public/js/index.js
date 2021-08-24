const ipc = require('electron').ipcRenderer

$(function() {
    beginFlow()
})


function beginFlow() {

    ipc.on('newData', async(evt, data) => {
        $('#outputBox').append(`<li class="list-group-item">${data}</li>`)
        $('#outputBox').stop().animate({ scrollTop: $('#outputBox')[0].scrollHeight }, 500);
    })

    $('#sendMessageButton').on('click', function() {
        ipc.send('sendMessage', $('#messageInput').val())
    })

}