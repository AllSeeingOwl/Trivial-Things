// Submit the form as soon as a new region is picked (the Update button still works without JavaScript).
(function () {
    var select = document.getElementById('region');
    if (select && select.form) {
        select.addEventListener('change', function () { select.form.submit(); });
    }
})();
