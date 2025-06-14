// Maximum number of events to keep in memory
const MAX_EVENTS = 1000;

// Store events in memory
let events = [];

// DOM elements
const eventStream = document.getElementById('event-stream');
const connectionStatus = document.getElementById('connection-status');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');

// Connect to background service worker
let port = null;

function connect() {
    port = chrome.runtime.connect({ name: "event-stream" });
    
    port.onMessage.addListener((event) => {
        addEvent(event);
    });
    
    port.onDisconnect.addListener(() => {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.className = 'status disconnected';
        // Try to reconnect after a delay
        setTimeout(connect, 1000);
    });
    
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'status connected';
}

// Add a new event to the display
function addEvent(event) {
    // Add to memory
    events.unshift(event);
    if (events.length > MAX_EVENTS) {
        events.pop();
    }
    
    // Create event element
    const eventElement = document.createElement('div');
    eventElement.className = 'event';
    
    // Format timestamp
    const timestamp = new Date(event.timeStamp).toISOString();
    
    // Create event content
    eventElement.innerHTML = `
        <span class="event-time">${timestamp}</span>
        <span class="event-type ${event.type}">${event.type.toUpperCase()}</span>
        <span class="event-details">${formatEventDetails(event)}</span>
    `;
    
    // Add to display
    eventStream.insertBefore(eventElement, eventStream.firstChild);
}

// Format event details based on event type
function formatEventDetails(event) {
    switch (event.type) {
        case 'navigation_committed':
        case 'navigation_completed':
            return `Tab ${event.tabId} | ${event.url}${event.searchQuery ? ` | Search: ${event.searchQuery}` : ''}`;
        case 'tab_activated':
        case 'tab_updated':
        case 'tab_removed':
            return `Tab ${event.tabId} | ${event.url || 'N/A'}${event.changeInfo ? ` | Changes: ${JSON.stringify(event.changeInfo)}` : ''}`;
        case 'download_created':
            return `${event.filename} | ${event.url} | ${event.mime}`;
        case 'download_changed':
        case 'download_erased':
            return `Download ID: ${event.downloadId || event.downloadDelta?.id} | ${JSON.stringify(event.downloadDelta || {})}`;
        case 'selection':
            return `Tab ${event.tabId} | "${event.selectedText}"`;
        case 'copy':
            return `Tab ${event.tabId} | "${event.copiedText}"`;
        case 'readability':
            return `Tab ${event.tabId} | ${event.title} | ${event.wordCount} words`;
        case 'heartbeat':
            return `Tab ${event.tabId} | ${event.secondsVisible}s visible`;
        case 'error':
            return `${event.error}${event.details ? ` | ${event.details}` : ''}`;
        case 'connection':
            return `${event.action} | ${event.portId}`;
        case 'message_received':
            return `From: ${typeof event.sender === 'string' ? event.sender : `Tab ${event.sender.tabId}`} | Type: ${event.message.type}`;
        case 'extension_startup':
        case 'extension_installed':
            return event.details ? JSON.stringify(event.details) : '';
        default:
            return JSON.stringify(event);
    }
}

// Clear all events
clearBtn.addEventListener('click', () => {
    events = [];
    eventStream.innerHTML = '';
});

// Export events to JSON file
exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-stream-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// Initial connection
connect(); 