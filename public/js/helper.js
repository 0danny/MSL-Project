function sendToast(text) {
    var toastLive = document.getElementById('liveToast')
    var toast = new bootstrap.Toast(toastLive)

    $('.toast-body').text(text)

    toast.show()
}

module.exports = { sendToast }