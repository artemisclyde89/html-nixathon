const isLocalDev = window.location.port === '5503' || window.location.port === '5501' || window.location.port === '5500';
let API_URL = isLocalDev ? 'http://localhost:8000' : window.location.origin;
const POLLING_INTERVAL = 2000;

let processedEventCount = 0;
let eventSource = null;

const container = document.getElementById('events-container');
const connectionStatus = document.getElementById('connection-status');
const apiUrlInput = document.getElementById('api-url');
const updateUrlBtn = document.getElementById('update-url-btn');
const jsonInput = document.getElementById('json-input');
const sendJsonBtn = document.getElementById('send-json-btn');
const inputStatus = document.getElementById('input-status');

const LOCAL_STORAGE_KEY = 'event_dashboard_history';

loadLocalEvents();
init();

function loadLocalEvents() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            const events = JSON.parse(saved);
            renderEvents(events, true); // true = initial load from local
        } catch (e) {
            console.error('Failed to load local history', e);
        }
    }
}

function saveEventLocally(event) {
    let events = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');

    // Check for duplicates
    if (events.some(e => e.id === event.id)) return;

    events.push(event);

    // Keep last 100
    if (events.length > 100) events.shift();

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
}

function init() {
    const savedUrl = localStorage.getItem('apiUrl');
    if (savedUrl) {
        API_URL = savedUrl;
        apiUrlInput.value = API_URL;
    }

    updateUrlBtn.addEventListener('click', updateApiUrl);
    sendJsonBtn.addEventListener('click', sendJsonEvent);

    jsonInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            sendJsonEvent();
        }
    });

    fetchEvents();
    setupEventSource();
}


function setupEventSource() {
    if (eventSource) {
        eventSource.close();
    }

    console.log('📡 Connecting to event stream...');
    eventSource = new EventSource(`${API_URL}/api/events/stream`);

    eventSource.onopen = () => {
        console.log('✅ Stream connected');
        updateStatus(true);
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleStreamEvent(data);
        } catch (err) {
            console.error('Error parsing stream data:', err);
        }
    };

    eventSource.onerror = (err) => {
        console.error('Stream error:', err);
        updateStatus(false);
        eventSource.close();
        // Try to reconnect after 5 seconds
        setTimeout(setupEventSource, 5000);
    };
}

function handleStreamEvent(data) {
    const { type, event } = data;

    if (type === 'new_event') {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const card = createEventCard(event);
        container.prepend(card);
        processedEventCount++;
        saveEventLocally(event);
    } else if (type === 'status_update') {
        updateEventCardStatus(event);
        updateEventInLocalHistory(event);
    }
}

function updateEventInLocalHistory(updatedEvent) {
    let events = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
        events[index] = updatedEvent;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
    }
}

function updateEventCardStatus(event) {
    const existingCard = document.querySelector(`.event-card[data-id="${event.id}"]`);
    if (!existingCard) return;

    if (event.forwarding) {
        let badge = existingCard.querySelector('.forwarding-badge');
        const newBadgeContent = `
            ${event.forwarding.status.toUpperCase()} ${event.forwarding.statusCode ? `(${event.forwarding.statusCode})` : ''}
        `;

        if (badge) {
            badge.textContent = newBadgeContent;
            badge.className = `forwarding-badge ${event.forwarding.status}`;
        } else {
            const headerRight = existingCard.querySelector('.header-right');
            const statusHtml = `
                <div class="forwarding-badge ${event.forwarding.status}">
                    ${newBadgeContent}
                </div>
            `;
            headerRight.insertAdjacentHTML('afterbegin', statusHtml);
        }
    }
}

function updateApiUrl() {
    const newUrl = apiUrlInput.value.replace(/\/$/, '');
    if (newUrl) {
        API_URL = newUrl;
        localStorage.setItem('apiUrl', API_URL);

        processedEventCount = 0;
        container.innerHTML = '<div class="empty-state">Connecting...</div>';
        fetchEvents();
        setupEventSource(); // Reconnect to new URL
    }
}

async function sendJsonEvent() {
    const jsonText = jsonInput.value.trim();

    if (!jsonText) {
        showInputStatus('Please enter some JSON', 'error');
        return;
    }

    try {
        const jsonData = JSON.parse(jsonText);

        sendJsonBtn.disabled = true;
        sendJsonBtn.textContent = 'Sending...';

        const response = await fetch(`${API_URL}/api/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonData)
        });

        if (!response.ok) throw new Error('Failed to send event');

        const result = await response.json();

        showInputStatus('✓ Event sent successfully!', 'success');
        jsonInput.value = '';

    } catch (error) {
        if (error instanceof SyntaxError) {
            showInputStatus('Invalid JSON format', 'error');
        } else {
            showInputStatus('Failed to send event', 'error');
        }
        console.error('Send error:', error);
    } finally {
        sendJsonBtn.disabled = false;
        sendJsonBtn.textContent = 'Send Event';
    }
}

function showInputStatus(message, type) {
    inputStatus.textContent = message;
    inputStatus.className = `input-status ${type}`;

    setTimeout(() => {
        inputStatus.textContent = '';
        inputStatus.className = 'input-status';
    }, 3000);
}

async function fetchEvents() {
    try {
        const response = await fetch(`${API_URL}/api/events`);

        if (!response.ok) throw new Error('Network response was not ok');

        const events = await response.json();

        updateStatus(true);
        renderEvents(events);

    } catch (error) {
        console.error('Fetch error:', error);
        updateStatus(false);
    }
}

function updateStatus(isOnline) {
    if (isOnline) {
        connectionStatus.textContent = 'Live';
        connectionStatus.style.color = 'var(--success)';
        document.querySelector('.dot').style.backgroundColor = 'var(--success)';
        document.querySelector('.dot').style.boxShadow = '0 0 8px var(--success)';
    } else {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = '#ef4444';
        document.querySelector('.dot').style.backgroundColor = '#ef4444';
        document.querySelector('.dot').style.boxShadow = '0 0 8px #ef4444';
    }
}

function renderEvents(events, isLocalLoad = false) {
    if (!events || events.length === 0) {
        if (!isLocalLoad) {
            container.innerHTML = '<div class="empty-state">No events yet. Send a POST request to add events.</div>';
        }
        processedEventCount = 0;
        return;
    }

    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Clear and render all
    container.innerHTML = '';
    events.forEach(event => {
        const card = createEventCard(event);
        container.prepend(card);
        if (!isLocalLoad) saveEventLocally(event);
    });

    processedEventCount = events.length;
}

function createEventCard(event) {
    const div = document.createElement('div');
    div.className = 'event-card';
    div.setAttribute('data-id', event.id || '');

    const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'Just now';
    const receivedAt = event.receivedAt || timestamp;

    const eventData = event.data || event;
    const jsonContent = JSON.stringify(eventData, null, 2);

    const typeBadge = `
        <span class="type-badge ${event.type || 'outbound'}">
            ${(event.type || 'outbound').toUpperCase()}
        </span>
    `;

    const forwardingStatus = event.forwarding ? `
        <div class="forwarding-badge ${event.forwarding.status}">
            ${event.forwarding.status.toUpperCase()} ${event.forwarding.statusCode ? `(${event.forwarding.statusCode})` : ''}
        </div>
    ` : '';

    div.innerHTML = `
        <div class="event-header">
            <span class="timestamp">${receivedAt}</span>
            <div class="header-right">
                ${typeBadge}
                ${forwardingStatus}
                <span>Data</span>
            </div>
        </div>
        <div class="event-content">${jsonContent}</div>
    `;

    return div;
}

window.addEvent = function (eventData) {
    const event = {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString()
    };
    saveEvent(event);
    console.log('Event added to localStorage:', event);
};
