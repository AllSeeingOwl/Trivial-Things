// Shared by the board (script.js) and the phone remote (host.js).
// Written in ES5 so the board runs in older smart-TV browsers too.
window.WhatTheSpell = {
    MODES: {
        'normal': 'Normal',
        'no-vowels': 'No Vowels',
        'backwards': 'Backwards',
        'both': 'No Vowels + Backwards'
    },
    // The spelling the player should say, as dashed capitals, e.g. "E-N-E-C-S".
    expectedSpelling: function (word, mode) {
        var result = word || '';
        if (mode === 'no-vowels' || mode === 'both') {
            result = result.replace(/[aeiouAEIOU]/g, '');
        }
        if (mode === 'backwards' || mode === 'both') {
            result = result.split('').reverse().join('');
        }
        return result.toUpperCase().split('').join('-');
    }
};
