export const LOCAL_STORAGE_KEY = 'event_dashboard_history';

/**
 * Loads events from local storage
 * @returns {Array} Array of events or null
 */
export function load() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to load local history', e);
        }
    }
    return null;
}

/**
 * Saves a single event to local storage (appends to list)
 * @param {object} event 
 */
export function saveEvent(event) {
    let events = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (events.some(e => e.id === event.id)) return;

    events.push(event);

    if (events.length > 100) events.shift();

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
}

/**
 * Updates an existing event in local storage
 * @param {object} updatedEvent 
 */
export function updateEvent(updatedEvent) {
    let events = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
        events[index] = updatedEvent;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
    }
}
