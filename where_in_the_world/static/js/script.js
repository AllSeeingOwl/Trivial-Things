document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const screens = {
        start: document.getElementById('start-screen'),
        game: document.getElementById('game-screen'),
        result: document.getElementById('result-screen'),
        end: document.getElementById('end-screen')
    };

    const ui = {
        startBtn: document.getElementById('start-btn'),
        roundSelect: document.getElementById('round-select'),
        currentPlace: document.getElementById('current-place'),
        currentPrompt: document.getElementById('current-prompt'),
        locationInput: document.getElementById('location-input'),
        searchBtn: document.getElementById('search-btn'),
        submitGuessBtn: document.getElementById('submit-guess-btn'),
        roundCounter: document.getElementById('round-counter'),
        scoreCounter: document.getElementById('score-counter'),
        resultTitle: document.getElementById('result-title'),
        resultDistance: document.getElementById('result-distance'),
        resultPoints: document.getElementById('result-points'),
        nextRoundBtn: document.getElementById('next-round-btn'),
        finalScore: document.getElementById('final-score'),
        playAgainBtn: document.getElementById('play-again-btn')
    };

    // --- State ---
    let state = {
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        totalRounds: 5,
        map: null,
        guessMarker: null,
        targetMarker: null,
        polyline: null,
        currentGuessLat: null,
        currentGuessLng: null
    };

    // --- Map Initialization ---
    function initMap() {
        if (!state.map) {
            state.map = L.map('map').setView([20, 0], 2);
            // We use standard OSM tiles. When offline, this will naturally fail,
            // but the map functionality (clicking to place markers) will still work on the gray background.
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(state.map);

            state.map.on('click', function(e) {
                placeGuessMarker(e.latlng.lat, e.latlng.lng);
            });
        }
    }

    // --- Parsing and Input Handling ---
    function parseDMS(input) {
        // Simple regex for degrees, minutes, seconds (rudimentary)
        const regex = /(\d+)[°\s](\d+)['\s]?(\d+(?:\.\d+)?)?["\s]?([NSEW])/ig;
        let match;
        let coords = { lat: null, lng: null };

        while ((match = regex.exec(input)) !== null) {
            let deg = parseFloat(match[1]);
            let min = parseFloat(match[2]) / 60;
            let sec = match[3] ? parseFloat(match[3]) / 3600 : 0;
            let dir = match[4].toUpperCase();

            let val = deg + min + sec;
            if (dir === 'S' || dir === 'W') {
                val = -val;
            }

            if (dir === 'N' || dir === 'S') {
                coords.lat = val;
            } else {
                coords.lng = val;
            }
        }

        if (coords.lat !== null && coords.lng !== null) {
            return [coords.lat, coords.lng];
        }
        return null;
    }

    async function handleSearch() {
        const query = ui.locationInput.value.trim();
        if (!query) return;

        ui.searchBtn.disabled = true;
        ui.searchBtn.textContent = 'Searching...';

        try {
            // 1. Check if it's decimal lat,lng
            const decMatch = query.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
            if (decMatch) {
                placeGuessMarker(parseFloat(decMatch[1]), parseFloat(decMatch[2]), true);
                return;
            }

            // 2. Check if it's Plus Code
            if (OpenLocationCode && OpenLocationCode.isValid(query) && OpenLocationCode.isFull(query)) {
                const codeArea = OpenLocationCode.decode(query);
                placeGuessMarker(codeArea.latitudeCenter, codeArea.longitudeCenter, true);
                return;
            }

            // 3. Check if it's Geohash (simple alpha-numeric check, usually 1-12 chars)
            if (/^[0123456789bcdefghjkmnpqrstuvwxyz]{4,12}$/.test(query)) {
                if (window.geohash) {
                    const decoded = geohash.decode(query.toLowerCase());
                    placeGuessMarker(decoded.latitude, decoded.longitude, true);
                    return;
                }
            }

            // 4. Try DMS parsing
            const dmsCoords = parseDMS(query);
            if (dmsCoords) {
                placeGuessMarker(dmsCoords[0], dmsCoords[1], true);
                return;
            }

            // 5. Fallback to Nominatim API (Place name search)
            if (!navigator.onLine) {
                alert('You appear to be offline. Place name search requires an internet connection. Please use coordinates, a Plus Code, or a Geohash, or click on the map.');
                return;
            }

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
                const data = await response.json();

                if (data && data.length > 0) {
                    placeGuessMarker(parseFloat(data[0].lat), parseFloat(data[0].lon), true);
                } else {
                    alert('Could not find location. Try a different format or name.');
                }
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                alert('Could not connect to the search service. Please check your internet connection or try a different format.');
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('An error occurred while searching. Please try again.');
        } finally {
            ui.searchBtn.disabled = false;
            ui.searchBtn.textContent = 'Locate';
        }
    }

    function placeGuessMarker(lat, lng, panTo = false) {
        state.currentGuessLat = lat;
        state.currentGuessLng = lng;

        if (state.guessMarker) {
            state.guessMarker.setLatLng([lat, lng]);
        } else {
            // Use default blue marker for guess
            state.guessMarker = L.marker([lat, lng]).addTo(state.map);
        }

        if (panTo) {
            state.map.setView([lat, lng], 10);
        }

        ui.submitGuessBtn.disabled = false;
    }

    // --- Game Flow ---
    function showScreen(screenId) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenId].classList.add('active');

        if (screenId === 'game') {
            // Need to invalidate size when map container becomes visible
            setTimeout(() => {
                if(state.map) state.map.invalidateSize();
            }, 10);
        }
    }

    function updateStats() {
        ui.roundCounter.textContent = `Round ${Math.min(state.currentQuestionIndex + 1, state.totalRounds)} / ${state.totalRounds}`;
        ui.scoreCounter.textContent = `Score: ${state.score}`;
    }

    async function startGame() {
        state.totalRounds = parseInt(ui.roundSelect.value);
        state.score = 0;
        state.currentQuestionIndex = 0;

        ui.startBtn.disabled = true;
        ui.startBtn.textContent = 'Loading...';

        try {
            const response = await fetch(`/api/questions?count=${state.totalRounds}`);
            state.questions = await response.json();

            if (state.questions.length === 0) {
                alert("Error: No questions loaded from server.");
                ui.startBtn.disabled = false;
                ui.startBtn.textContent = 'Start Game';
                return;
            }

            initMap();
            loadQuestion();
        } catch (error) {
            console.error("Failed to load questions", error);
            alert("Failed to connect to the server.");
            ui.startBtn.disabled = false;
            ui.startBtn.textContent = 'Start Game';
        }
    }

    function loadQuestion() {
        const q = state.questions[state.currentQuestionIndex];
        ui.currentPlace.textContent = q.place;
        ui.currentPrompt.textContent = q.prompt;

        // Reset Map State for new round
        if (state.guessMarker) {
            state.map.removeLayer(state.guessMarker);
            state.guessMarker = null;
        }
        if (state.targetMarker) {
            state.map.removeLayer(state.targetMarker);
            state.targetMarker = null;
        }
        if (state.polyline) {
            state.map.removeLayer(state.polyline);
            state.polyline = null;
        }

        state.currentGuessLat = null;
        state.currentGuessLng = null;
        ui.submitGuessBtn.disabled = true;
        ui.locationInput.value = '';

        // Reset view to world level
        state.map.setView([20, 0], 2);

        updateStats();
        showScreen('game');
    }

    async function submitGuess() {
        if (state.currentGuessLat === null || state.currentGuessLng === null) return;

        const q = state.questions[state.currentQuestionIndex];
        ui.submitGuessBtn.disabled = true;

        try {
            const response = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: q.id,
                    lat: state.currentGuessLat,
                    lng: state.currentGuessLng
                })
            });

            const data = await response.json();
            if (data.error) {
                alert(data.error);
                return;
            }

            // Draw Target Pin and Line
            const redIcon = new L.Icon({
                iconUrl: '/static/img/marker-icon-2x-red.png',
                shadowUrl: '/static/vendor/leaflet/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            state.targetMarker = L.marker([data.target_lat, data.target_lng], {icon: redIcon})
                .bindPopup("Target Location")
                .addTo(state.map);

            state.polyline = L.polyline([
                [state.currentGuessLat, state.currentGuessLng],
                [data.target_lat, data.target_lng]
            ], {color: 'red', dashArray: '5, 10'}).addTo(state.map);

            // Fit bounds to show both markers
            const bounds = L.latLngBounds(
                [state.currentGuessLat, state.currentGuessLng],
                [data.target_lat, data.target_lng]
            );
            state.map.fitBounds(bounds, {padding: [50, 50]});

            // Update Score and Show Result
            state.score += data.score;
            ui.resultDistance.textContent = data.distance_miles.toFixed(2);
            ui.resultPoints.textContent = data.score;

            if (data.score === 10) {
                ui.resultTitle.textContent = "Bullseye! 🎯";
            } else if (data.score === 5) {
                ui.resultTitle.textContent = "Very Close! 🔥";
            } else if (data.score === 2) {
                ui.resultTitle.textContent = "Close! 👏";
            } else {
                ui.resultTitle.textContent = "Far Away! ❄️";
            }

            setTimeout(() => {
                showScreen('result');
                updateStats();
            }, 2500); // 2.5 second delay to see the map line

        } catch (error) {
            console.error("Submit error:", error);
            alert("Error submitting guess.");
            ui.submitGuessBtn.disabled = false;
        }
    }

    function nextRound() {
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex >= state.totalRounds) {
            endGame();
        } else {
            loadQuestion();
        }
    }

    function endGame() {
        ui.finalScore.textContent = state.score;
        showScreen('end');
    }

    // --- Event Listeners ---
    ui.startBtn.addEventListener('click', startGame);
    ui.searchBtn.addEventListener('click', handleSearch);
    ui.locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    ui.submitGuessBtn.addEventListener('click', submitGuess);
    ui.nextRoundBtn.addEventListener('click', nextRound);
    ui.playAgainBtn.addEventListener('click', () => {
        ui.startBtn.disabled = false;
        ui.startBtn.textContent = 'Start Game';
        showScreen('start');
    });
});
