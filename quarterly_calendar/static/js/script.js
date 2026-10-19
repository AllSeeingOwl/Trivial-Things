(function() {
    var link = document.getElementById('portal-back-link');
    if (link) {
        var h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.') || h.startsWith('10.')) {
            link.href = 'http://' + h + ':8080';
        }
    }
})();

let events = [];
let eventToDelete = null;

const yearContainer = document.getElementById('year-container');
const form = document.getElementById('add-event-form');
const modal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const modalEventTitle = document.getElementById('modal-event-title');

const currentYear = new Date().getFullYear();

const monthNames = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];

// Setup the UI layout for Quarters and Months
function initializeCalendarUI() {
    yearContainer.innerHTML = '';
    for (let q = 0; q < 4; q++) {
        const quarterDiv = document.createElement('div');
        quarterDiv.className = 'bg-white p-6 rounded-lg shadow-md';

        const qTitle = document.createElement('h2');
        qTitle.className = 'text-2xl font-bold mb-4 text-gray-800 border-b pb-2';
        qTitle.textContent = `Q${q + 1} ${currentYear}`;
        quarterDiv.appendChild(qTitle);

        const monthsGrid = document.createElement('div');
        monthsGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

        for (let m = 0; m < 3; m++) {
            const monthIndex = (q * 3) + m;
            const monthWrapper = createMonthGrid(currentYear, monthIndex);
            monthsGrid.appendChild(monthWrapper);
        }

        quarterDiv.appendChild(monthsGrid);
        yearContainer.appendChild(quarterDiv);
    }
}

function createMonthGrid(year, monthIndex) {
    const wrapper = document.createElement('div');

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold mb-2 text-center text-gray-700';
    title.textContent = monthNames[monthIndex];
    wrapper.appendChild(title);

    // Days of week header
    const dowHeader = document.createElement('div');
    dowHeader.className = 'grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-1';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const d = document.createElement('div');
        d.textContent = day;
        dowHeader.appendChild(d);
    });
    wrapper.appendChild(dowHeader);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.id = `grid-${year}-${monthIndex}`;

    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();

    // Previous month inactive days
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell inactive';
        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = prevMonthDays - firstDay + i + 1;
        cell.appendChild(dayNum);
        grid.appendChild(cell);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell flex flex-col';
        cell.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = i;
        cell.appendChild(dayNum);

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'flex flex-col space-y-1 mt-1 flex-grow overflow-y-auto';
        eventsContainer.id = `events-${cell.dataset.date}`;
        cell.appendChild(eventsContainer);

        grid.appendChild(cell);
    }

    // Next month inactive days to fill grid (42 cells total)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell inactive';
        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = i;
        cell.appendChild(dayNum);
        grid.appendChild(cell);
    }

    wrapper.appendChild(grid);
    return wrapper;
}

async function fetchEvents() {
    try {
        const res = await fetch('/api/events');
        events = await res.json();
        renderEvents();
    } catch (err) {
        console.error("Failed to fetch events", err);
    }
}

function renderEvents() {
    // Clear all event containers
    document.querySelectorAll('[id^="events-"]').forEach(el => el.innerHTML = '');

    // Simple rendering: just place the event bar in every day it covers
    events.forEach(event => {
        let current = new Date(event.start_date + 'T00:00:00'); // Force local interpretation
        const end = new Date(event.end_date + 'T00:00:00');

        while (current <= end) {
            const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            const container = document.getElementById(`events-${dateStr}`);

            if (container) {
                const eventEl = document.createElement('div');
                eventEl.className = `event-bar event-${event.category.toLowerCase()} ${event.is_tentative ? 'event-tentative' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500`;
                eventEl.textContent = event.title;
                eventEl.title = `${event.title} (${event.start_date} to ${event.end_date})`;
                eventEl.setAttribute('role', 'button');
                eventEl.setAttribute('tabindex', '0');
                eventEl.setAttribute('aria-label', `${event.title}, ${event.category} event from ${event.start_date} to ${event.end_date}`);

                eventEl.onclick = () => showDeleteModal(event);
                eventEl.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        showDeleteModal(event);
                    }
                };

                container.appendChild(eventEl);
            }

            current.setDate(current.getDate() + 1);
        }
    });
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
            title: formData.get('title'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            category: formData.get('category'),
            is_tentative: formData.get('is_tentative') === 'on'
        };

        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                form.reset();
                fetchEvents();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add event');
            }
        } catch (err) {
            console.error(err);
            alert('Error adding event');
        }
    });
}

function showDeleteModal(event) {
    eventToDelete = event;
    modalEventTitle.textContent = `Delete: ${event.title}`;
    modal.classList.remove('hidden');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.focus();
    }
}

function hideDeleteModal() {
    eventToDelete = null;
    modal.classList.add('hidden');
}

if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
}

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!eventToDelete) return;

        try {
            const res = await fetch(`/api/events/${eventToDelete.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                hideDeleteModal();
                fetchEvents();
            } else {
                alert('Failed to delete event');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting event');
        }
    });
}

// Init
initializeCalendarUI();
fetchEvents();
