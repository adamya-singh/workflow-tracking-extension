// Create the off-screen document at startup to handle heavy parsing tasks
chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Heavy parsing off UI thread'
}).catch(error => {
    console.error('Failed to create off-screen document:', error);
    broadcastEvent({
        type: 'error',
        timeStamp: Date.now(),
        error: 'Failed to create off-screen document',
        details: error.message
    });
});

// Maintain list of connected stream pages
let streamPorts = [];

// Handle stream page connections
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "event-stream") {
        streamPorts.push(port);
        broadcastEvent({
            type: 'connection',
            timeStamp: Date.now(),
            action: 'connected',
            portId: port.name
        });
        
        port.onDisconnect.addListener(() => {
            streamPorts = streamPorts.filter(p => p !== port);
            broadcastEvent({
                type: 'connection',
                timeStamp: Date.now(),
                action: 'disconnected',
                portId: port.name
            });
        });
    }
});

// Broadcast event to all connected stream pages
function broadcastEvent(event) {
    streamPorts.forEach(port => {
        try {
            port.postMessage(event);
        } catch (e) {
            console.error('Failed to broadcast event:', e);
            broadcastEvent({
                type: 'error',
                timeStamp: Date.now(),
                error: 'Failed to broadcast event',
                details: e.message
            });
        }
    });
}

// Log all navigation events
chrome.webNavigation.onCommitted.addListener(details => {
    try {
        const { tabId, url, transitionType, timeStamp } = details;
        const searchQuery = url.includes('q=') ? new URL(url).searchParams.get('q') : null;
        const event = {
            type: 'navigation_committed',
            timeStamp,
            tabId,
            url,
            transitionType,
            searchQuery
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in navigation_committed handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in navigation_committed handler',
            details: error.message
        });
    }
});

chrome.webNavigation.onCompleted.addListener(details => {
    try {
        const { tabId, url, timeStamp } = details;
        const event = {
            type: 'navigation_completed',
            timeStamp,
            tabId,
            url
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in navigation_completed handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in navigation_completed handler',
            details: error.message
        });
    }
});

// Log all tab events
chrome.tabs.onActivated.addListener(activeInfo => {
    try {
        chrome.tabs.get(activeInfo.tabId, tab => {
            const event = {
                type: 'tab_activated',
                timeStamp: Date.now(),
                tabId: activeInfo.tabId,
                url: tab.url
            };
            console.log(event);
            broadcastEvent(event);
        });
    } catch (error) {
        console.error('Error in tab_activated handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in tab_activated handler',
            details: error.message
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    try {
        const event = {
            type: 'tab_updated',
            timeStamp: Date.now(),
            tabId,
            changeInfo,
            url: tab.url
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in tab_updated handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in tab_updated handler',
            details: error.message
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    try {
        const event = {
            type: 'tab_removed',
            timeStamp: Date.now(),
            tabId,
            removeInfo
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in tab_removed handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in tab_removed handler',
            details: error.message
        });
    }
});

// Log all download events
chrome.downloads.onCreated.addListener(downloadItem => {
    try {
        const event = {
            type: 'download_created',
            timeStamp: Date.now(),
            filename: downloadItem.filename,
            url: downloadItem.url,
            mime: downloadItem.mime
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in download_created handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in download_created handler',
            details: error.message
        });
    }
});

chrome.downloads.onChanged.addListener((downloadDelta) => {
    try {
        const event = {
            type: 'download_changed',
            timeStamp: Date.now(),
            downloadDelta
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in download_changed handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in download_changed handler',
            details: error.message
        });
    }
});

chrome.downloads.onErased.addListener((downloadId) => {
    try {
        const event = {
            type: 'download_erased',
            timeStamp: Date.now(),
            downloadId
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in download_erased handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in download_erased handler',
            details: error.message
        });
    }
});

// Set up heartbeat for active tab
let heartbeatInterval = null;
let lastActiveTabId = null;

function startHeartbeat(tabId) {
    try {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        lastActiveTabId = tabId;
        let secondsVisible = 0;
        
        heartbeatInterval = setInterval(() => {
            if (lastActiveTabId === tabId) {
                secondsVisible += 15;
                const event = {
                    type: 'heartbeat',
                    timeStamp: Date.now(),
                    tabId,
                    secondsVisible
                };
                console.log(event);
                broadcastEvent(event);
            }
        }, 15000);
    } catch (error) {
        console.error('Error in startHeartbeat:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in startHeartbeat',
            details: error.message
        });
    }
}

// Update heartbeat when tab changes
chrome.tabs.onActivated.addListener(activeInfo => {
    startHeartbeat(activeInfo.tabId);
});

// Log all messages between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        // Log the incoming message
        const messageEvent = {
            type: 'message_received',
            timeStamp: Date.now(),
            message,
            sender: sender.tab ? { tabId: sender.tab.id, url: sender.tab.url } : 'background'
        };
        console.log(messageEvent);
        broadcastEvent(messageEvent);

        if (message.type === 'html') {
            // Forward the HTML to the off-screen document for parsing
            chrome.runtime.sendMessage({ type: 'parse', html: message.html }, response => {
                if (chrome.runtime.lastError) {
                    const errorEvent = {
                        type: 'error',
                        timeStamp: Date.now(),
                        error: 'Error sending message to off-screen document',
                        details: chrome.runtime.lastError.message
                    };
                    console.error(errorEvent);
                    broadcastEvent(errorEvent);
                } else {
                    const event = {
                        type: 'readability',
                        timeStamp: Date.now(),
                        tabId: sender.tab.id,
                        ...response
                    };
                    console.log('Parsed article:', event);
                    broadcastEvent(event);
                }
            });
        } else if (message.type === 'selection') {
            const event = {
                type: 'selection',
                timeStamp: Date.now(),
                tabId: sender.tab.id,
                selectedText: message.text
            };
            console.log(event);
            broadcastEvent(event);
        } else if (message.type === 'copy') {
            const event = {
                type: 'copy',
                timeStamp: Date.now(),
                tabId: sender.tab.id,
                copiedText: message.text
            };
            console.log(event);
            broadcastEvent(event);
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in message handler',
            details: error.message
        });
    }
});

// Log extension lifecycle events
chrome.runtime.onStartup.addListener(() => {
    try {
        const event = {
            type: 'extension_startup',
            timeStamp: Date.now()
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in extension_startup handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in extension_startup handler',
            details: error.message
        });
    }
});

chrome.runtime.onInstalled.addListener((details) => {
    try {
        const event = {
            type: 'extension_installed',
            timeStamp: Date.now(),
            details
        };
        console.log(event);
        broadcastEvent(event);
    } catch (error) {
        console.error('Error in extension_installed handler:', error);
        broadcastEvent({
            type: 'error',
            timeStamp: Date.now(),
            error: 'Error in extension_installed handler',
            details: error.message
        });
    }
});

// Service worker error handling
self.onerror = (event) => {
    console.error('Service worker error:', event);
    broadcastEvent({
        type: 'error',
        timeStamp: Date.now(),
        error: 'Service worker error',
        details: event.message || 'Unknown error'
    });
};

self.onunhandledrejection = (event) => {
    console.error('Unhandled promise rejection:', event);
    broadcastEvent({
        type: 'error',
        timeStamp: Date.now(),
        error: 'Unhandled promise rejection',
        details: event.reason?.message || 'Unknown error'
    });
};