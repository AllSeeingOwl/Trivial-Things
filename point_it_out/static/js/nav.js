// When run locally, point the back link at the local portal instead of Render.
(function () {
    var link = document.getElementById('portal-back-link');
    if (!link) return;
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.') || h.startsWith('10.')) {
        link.href = 'http://' + h + ':8080';
    }
})();
