// Shared by the board (script.js) and the phone remote (host.js).
window.WhatTheSpell = {
    MODES: {
        'normal': 'Normal',
        'no-vowels': 'No Vowels',
        'backwards': 'Backwards',
        'both': 'No Vowels + Backwards'
    },
    // The spelling the player should say, as dashed capitals, e.g. "E-N-E-C-S".
    expectedSpelling: function (word, mode) {
        let result = word || '';
        if (mode === 'no-vowels' || mode === 'both') {
            result = result.replace(/[aeiouAEIOU]/g, '');
        }
        if (mode === 'backwards' || mode === 'both') {
            result = result.split('').reverse().join('');
        }
        return result.toUpperCase().split('').join('-');
    }
};
