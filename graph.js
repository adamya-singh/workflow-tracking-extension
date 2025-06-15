// Event category mapping based on event-types.md
const EVENT_CATEGORIES = {
    // Navigation Events
    'navigation_committed': 'Navigation Events',
    'navigation_completed': 'Navigation Events',
    
    // Tab Management Events  
    'tab_activated': 'Tab Management Events',
    'tab_updated': 'Tab Management Events',
    'tab_removed': 'Tab Management Events',
    
    // Download Events
    'download_created': 'Download Events',
    'download_changed': 'Download Events', 
    'download_erased': 'Download Events',
    
    // Content Events
    'selection': 'Content Events',
    'copy': 'Content Events',
    'readability': 'Content Events',
    
    // Lifecycle & Monitoring Events
    'heartbeat': 'Lifecycle & Monitoring Events',
    'extension_startup': 'Lifecycle & Monitoring Events',
    'extension_installed': 'Lifecycle & Monitoring Events',
    
    // Communication Events
    'message_received': 'Communication Events',
    'connection': 'Communication Events',
    
    // Error Events
    'error': 'Error Events',
    
    // Secondary Events (Via message_received)
    'visibility_change': 'Secondary Events',
    'window_focus': 'Secondary Events',
    'content_script_loaded': 'Secondary Events',
    'content_script_error': 'Secondary Events'
};

// Category colors for visualization
const CATEGORY_COLORS = {
    'Navigation Events': '#2196F3',
    'Tab Management Events': '#4CAF50',
    'Download Events': '#FF9800',
    'Content Events': '#9C27B0',
    'Lifecycle & Monitoring Events': '#607D8B',
    'Communication Events': '#795548',
    'Error Events': '#F44336',
    'Secondary Events': '#9E9E9E'
};

// Global variables
let events = [];
let network = null;
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
let port = null;
let activeFilters = new Set(Object.keys(CATEGORY_COLORS));

// DOM elements
const graphContainer = document.getElementById('graph');
const connectionStatus = document.getElementById('connection-status');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const jsonImport = document.getElementById('json-import');
const categoryFilters = document.getElementById('category-filters');
const totalEventsSpan = document.getElementById('total-events');
const visibleEventsSpan = document.getElementById('visible-events');
const timeSpanSpan = document.getElementById('time-span');

// Initialize the graph
function initializeGraph() {
    const data = {
        nodes: nodes,
        edges: edges
    };

    const options = {
        layout: {
            hierarchical: {
                direction: 'LR',
                sortMethod: 'directed',
                levelSeparation: 150,
                nodeSpacing: 100
            }
        },
        physics: {
            enabled: false
        },
        nodes: {
            shape: 'dot',
            size: 10,
            font: {
                size: 12,
                color: '#333'
            },
            borderWidth: 2
        },
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 0.5 }
            },
            color: '#848484',
            width: 1,
            smooth: {
                type: 'continuous'
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200
        }
    };

    network = new vis.Network(graphContainer, data, options);
    
    // Add click event listener for node details
    network.on('click', function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const event = events.find(e => e.id === nodeId);
            if (event) {
                showEventDetails(event);
            }
        }
    });
}

// Create category filters
function createCategoryFilters() {
    categoryFilters.innerHTML = '';
    
    Object.entries(CATEGORY_COLORS).forEach(([category, color]) => {
        const label = document.createElement('label');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', () => toggleCategory(category));
        
        const colorDiv = document.createElement('div');
        colorDiv.className = 'category-color';
        colorDiv.style.backgroundColor = color;
        
        const text = document.createTextNode(category);
        
        label.appendChild(checkbox);
        label.appendChild(colorDiv);
        label.appendChild(text);
        
        categoryFilters.appendChild(label);
    });
}

// Toggle category visibility
function toggleCategory(category) {
    if (activeFilters.has(category)) {
        activeFilters.delete(category);
    } else {
        activeFilters.add(category);
    }
    updateGraphVisibility();
}

// Update graph visibility based on filters
function updateGraphVisibility() {
    const visibleNodeIds = [];
    const visibleEdgeIds = [];
    
    events.forEach(event => {
        const category = EVENT_CATEGORIES[event.type] || 'Unknown';
        if (activeFilters.has(category)) {
            visibleNodeIds.push(event.id);
        }
    });
    
    // Show edges only between visible nodes
    edges.forEach(edge => {
        if (visibleNodeIds.includes(edge.from) && visibleNodeIds.includes(edge.to)) {
            visibleEdgeIds.push(edge.id);
        }
    });
    
    // Update node visibility
    nodes.forEach(node => {
        const isVisible = visibleNodeIds.includes(node.id);
        nodes.update({
            id: node.id,
            hidden: !isVisible
        });
    });
    
    // Update edge visibility
    edges.forEach(edge => {
        const isVisible = visibleEdgeIds.includes(edge.id);
        edges.update({
            id: edge.id,
            hidden: !isVisible
        });
    });
    
    updateStats();
}

// Connect to background service worker for real-time events
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

// Add a new event to the graph
function addEvent(event) {
    // Add unique ID if not present
    event.id = event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    events.push(event);
    
    // Classify event
    const category = EVENT_CATEGORIES[event.type] || 'Unknown';
    const color = CATEGORY_COLORS[category] || '#999999';
    
    // Create node
    const node = {
        id: event.id,
        label: event.type,
        color: {
            background: color,
            border: darkenColor(color, 20)
        },
        title: formatEventTooltip(event),
        category: category
    };
    
    nodes.add(node);
    
    // Create edge to previous event (chronological order)
    if (events.length > 1) {
        const previousEvent = events[events.length - 2];
        const edge = {
            id: `edge_${previousEvent.id}_${event.id}`,
            from: previousEvent.id,
            to: event.id
        };
        edges.add(edge);
    }
    
    updateStats();
}

// Format event for tooltip
function formatEventTooltip(event) {
    let tooltip = `<strong>${event.type}</strong><br>`;
    tooltip += `Time: ${new Date(event.timeStamp).toLocaleString()}<br>`;
    
    switch (event.type) {
        case 'navigation_committed':
        case 'navigation_completed':
            tooltip += `Tab: ${event.tabId}<br>URL: ${event.url}`;
            if (event.searchQuery) tooltip += `<br>Search: ${event.searchQuery}`;
            break;
        case 'tab_activated':
        case 'tab_updated':
        case 'tab_removed':
            tooltip += `Tab: ${event.tabId}<br>URL: ${event.url || 'N/A'}`;
            break;
        case 'selection':
            tooltip += `Tab: ${event.tabId}<br>Text: "${event.selectedText?.substring(0, 100)}..."`;
            break;
        case 'copy':
            tooltip += `Tab: ${event.tabId}<br>Text: "${event.copiedText?.substring(0, 100)}..."`;
            break;
        case 'readability':
            tooltip += `Tab: ${event.tabId}<br>Title: ${event.title}<br>Words: ${event.wordCount}`;
            break;
        case 'download_created':
            tooltip += `File: ${event.filename}<br>URL: ${event.url}`;
            break;
        case 'error':
            tooltip += `Error: ${event.error}<br>Details: ${event.details}`;
            break;
        default:
            tooltip += `Data: ${JSON.stringify(event).substring(0, 200)}...`;
    }
    
    return tooltip;
}

// Show detailed event information
function showEventDetails(event) {
    alert(`Event Details:\n\n${JSON.stringify(event, null, 2)}`);
}

// Darken a color by a percentage
function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// Update statistics
function updateStats() {
    totalEventsSpan.textContent = events.length;
    
    const visibleNodes = nodes.get().filter(node => !node.hidden);
    visibleEventsSpan.textContent = visibleNodes.length;
    
    if (events.length > 0) {
        const startTime = Math.min(...events.map(e => e.timeStamp));
        const endTime = Math.max(...events.map(e => e.timeStamp));
        const duration = endTime - startTime;
        timeSpanSpan.textContent = formatDuration(duration);
    } else {
        timeSpanSpan.textContent = '-';
    }
}

// Format duration in human readable format
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// Clear all events and graph
function clearGraph() {
    events = [];
    nodes.clear();
    edges.clear();
    updateStats();
}

// Export current events
function exportEvents() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-graph-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Import events from JSON file
function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedEvents = JSON.parse(e.target.result);
            
            // Clear existing data
            clearGraph();
            
            // Sort events by timestamp
            importedEvents.sort((a, b) => a.timeStamp - b.timeStamp);
            
            // Add all events
            importedEvents.forEach(event => addEvent(event));
            
            // Update connection status for imported data
            connectionStatus.textContent = 'JSON Data Loaded';
            connectionStatus.className = 'status connected';
            
        } catch (error) {
            alert('Error importing JSON file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Layout controls
function setTimelineLayout() {
    const options = {
        layout: {
            hierarchical: {
                direction: 'LR',
                sortMethod: 'directed',
                levelSeparation: 150,
                nodeSpacing: 100
            }
        },
        physics: { enabled: false }
    };
    network.setOptions(options);
}

function setHierarchicalLayout() {
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 100,
                nodeSpacing: 150
            }
        },
        physics: { enabled: false }
    };
    network.setOptions(options);
}

function setForceLayout() {
    const options = {
        layout: {
            hierarchical: false
        },
        physics: {
            enabled: true,
            stabilization: { iterations: 100 }
        }
    };
    network.setOptions(options);
}

// Event listeners
clearBtn.addEventListener('click', clearGraph);
exportBtn.addEventListener('click', exportEvents);
resetViewBtn.addEventListener('click', () => network.fit());

jsonImport.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importFromJSON(e.target.files[0]);
    }
});

document.getElementById('timeline-layout').addEventListener('click', setTimelineLayout);
document.getElementById('hierarchical-layout').addEventListener('click', setHierarchicalLayout);
document.getElementById('force-layout').addEventListener('click', setForceLayout);

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initializeGraph();
    createCategoryFilters();
    connect();
}); 