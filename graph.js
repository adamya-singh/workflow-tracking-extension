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

// Bucket mapping for Smart Bucket View
const BUCKET_MAPPING = {
    // Page Navigation (consolidated)
    'navigation_committed': 'page_navigation',
    'navigation_completed': 'page_navigation',
    'tab_updated': 'page_navigation', // Include tab updates with navigation
    'tab_activated': 'page_navigation', // Include tab activation with navigation
    
    // Page Interaction (consolidated)
    'selection': 'page_interaction',
    'copy': 'page_interaction', 
    'download_created': 'page_interaction',
    'readability': 'page_interaction',
    
    // Focus/Context (consolidated)
    'window_focus': 'tab_focus',
    'visibility_change': 'tab_focus',
    'heartbeat': 'tab_focus',
    
    // System & Extension
    'extension_startup': 'system_extension',
    'extension_installed': 'system_extension',
    'content_script_loaded': 'system_extension',
    
    // Resource Transfers
    'download_changed': 'resource_transfers',
    'download_erased': 'resource_transfers',
    
    // Inter-Process Comms (mostly filtered)
    'message_received': 'inter_process_comms',
    'connection': 'inter_process_comms',
    
    // Errors
    'error': 'errors',
    'content_script_error': 'errors'
};

const BUCKET_DISPLAY = {
    'page_navigation': { label: 'Navigation', color: '#2196F3', priority: 1 },
    'page_interaction': { label: 'Interactions', color: '#9C27B0', priority: 2 },
    'tab_focus': { label: 'Focus/Context', color: '#4CAF50', priority: 3 },
    'resource_transfers': { label: 'Downloads', color: '#795548', priority: 4 },
    'system_extension': { label: 'System', color: '#607D8B', priority: 5 },
    'inter_process_comms': { label: 'Comms', color: '#9E9E9E', priority: 6, hidden: true },
    'errors': { label: 'Errors', color: '#F44336', priority: 7 }
};

// Global variables
let events = [];
let network = null;
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
let port = null;
let activeFilters = new Set(Object.keys(CATEGORY_COLORS));
let currentLayoutMode = 'timeline'; // Track current layout mode
let currentBucketInstances = []; // Store bucket instances for export

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
            
            // Check if it's a bucket node
            if (nodeId.startsWith('bucket_')) {
                const node = nodes.get(nodeId);
                showBucketDetails(node);
            } else {
                // Handle regular event nodes
                const event = events.find(e => e.id === nodeId);
                if (event) {
                    showEventDetails(event);
                }
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

// Show detailed bucket information
function showBucketDetails(bucketNode) {
    const bucketData = bucketNode.bucketData;
    const display = BUCKET_DISPLAY[bucketNode.bucketName];
    
    let details = `=== ${display.label} Bucket ===\n\n`;
    details += `Total Events: ${bucketData.events.length}\n`;
    details += `Metrics: ${JSON.stringify(bucketData.metrics, null, 2)}\n\n`;
    details += `Recent Events:\n`;
    
    bucketData.events
        .slice(-5) // Show last 5 events
        .forEach(event => {
            details += `• ${event.type} - ${new Date(event.timeStamp).toLocaleTimeString()}\n`;
        });
    
    alert(details);
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

// Export current events or bucket data
function exportEvents() {
    let dataToExport;
    let filename;
    
    if (currentLayoutMode === 'smart-bucket' && currentBucketInstances.length > 0) {
        // Export bucket instances with metadata
        dataToExport = {
            type: 'smart-bucket-data',
            exportedAt: new Date().toISOString(),
            totalEvents: events.length,
            bucketInstances: currentBucketInstances,
            rawEvents: events // Include raw events for reference
        };
        filename = `smart-bucket-workflow-${new Date().toISOString()}.json`;
    } else {
        // Export raw events
        dataToExport = events;
        filename = `event-graph-${new Date().toISOString()}.json`;
    }
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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

// Update export button text based on current layout mode
function updateExportButtonText() {
    const exportBtn = document.getElementById('export-btn');
    if (currentLayoutMode === 'smart-bucket') {
        exportBtn.textContent = 'Export Bucket Data';
        exportBtn.title = 'Export processed bucket instances and workflow data';
    } else {
        exportBtn.textContent = 'Export Data';
        exportBtn.title = 'Export raw event data';
    }
}

// Layout controls
function setTimelineLayout() {
    currentLayoutMode = 'timeline';
    updateExportButtonText();
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
    currentLayoutMode = 'hierarchical';
    updateExportButtonText();
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
    currentLayoutMode = 'force';
    updateExportButtonText();
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

// Smart View layout - groups events by page with hierarchical levels
function setSmartLayout() {
    console.log("Smart View layout requested");
    currentLayoutMode = 'smart';
    updateExportButtonText();
    
    // Group events by page and assign hierarchical levels
    const pageGroups = analyzePageGroups();
    
    // Update nodes with level information for hierarchical layout
    updateNodesWithLevels(pageGroups);
    
    // Apply hierarchical layout with custom levels
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD', // Top to bottom
                sortMethod: 'directed',
                levelSeparation: 120,
                nodeSpacing: 80,
                treeSpacing: 100,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true
            }
        },
        physics: { 
            enabled: false 
        },
        nodes: {
            shape: 'box',
            margin: 10,
            font: {
                size: 11,
                align: 'center'
            },
            borderWidth: 2,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5,
                x: 2,
                y: 2
            }
        },
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 0.8 }
            },
            color: '#666',
            width: 2,
            smooth: {
                type: 'cubicBezier',
                forceDirection: 'vertical',
                roundness: 0.4
            }
        }
    };
    
    network.setOptions(options);
    
    // Fit the view to show the entire hierarchy
    setTimeout(() => {
        network.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }, 100);
}

// Analyze events and group them by page visits
function analyzePageGroups() {
    const pageGroups = [];
    let currentGroup = null;
    let currentUrl = null;
    let level = 0;
    
    // Sort events by timestamp to ensure chronological order
    const sortedEvents = [...events].sort((a, b) => a.timeStamp - b.timeStamp);
    
    sortedEvents.forEach(event => {
        // Check if this is a navigation event that indicates a page change
        if (event.type === 'navigation_committed' && event.url !== currentUrl) {
            // Start a new page group
            if (currentGroup && currentGroup.events.length > 0) {
                pageGroups.push(currentGroup);
                level++;
            }
            
            currentUrl = event.url;
            currentGroup = {
                url: currentUrl,
                level: level,
                events: [],
                startTime: event.timeStamp,
                title: getPageTitle(currentUrl)
            };
        }
        
        // If we don't have a current group yet, create one
        if (!currentGroup) {
            currentUrl = event.url || 'Unknown';
            currentGroup = {
                url: currentUrl,
                level: level,
                events: [],
                startTime: event.timeStamp,
                title: getPageTitle(currentUrl)
            };
        }
        
        // Add event to current group
        currentGroup.events.push(event);
        currentGroup.endTime = event.timeStamp;
    });
    
    // Add the last group
    if (currentGroup && currentGroup.events.length > 0) {
        pageGroups.push(currentGroup);
    }
    
    return pageGroups;
}

// Extract a readable title from URL
function getPageTitle(url) {
    if (!url) return 'Unknown Page';
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        
        // For extension pages
        if (url.startsWith('chrome-extension://')) {
            if (url.includes('stream.html')) return 'Event Stream';
            if (url.includes('graph.html')) return 'Event Graph';
            return 'Extension Page';
        }
        
        // For regular websites
        if (hostname.includes('google.com')) return 'Google';
        if (hostname.includes('github.com')) return 'GitHub';
        if (hostname.includes('stackoverflow.com')) return 'Stack Overflow';
        
        // Default to hostname
        return hostname.replace('www.', '');
    } catch (e) {
        return 'Unknown Page';
    }
}

// Update nodes with hierarchical level information
function updateNodesWithLevels(pageGroups) {
    // Clear existing nodes and edges
    nodes.clear();
    edges.clear();
    
    let nodePositionInLevel = {};
    
    pageGroups.forEach((group, groupIndex) => {
        const level = group.level;
        
        // Initialize position counter for this level
        if (!nodePositionInLevel[level]) {
            nodePositionInLevel[level] = 0;
        }
        
        // Add a page header node
        const pageHeaderId = `page_${groupIndex}`;
        const pageHeaderNode = {
            id: pageHeaderId,
            label: group.title,
            level: level,
            color: {
                background: '#E3F2FD',
                border: '#1976D2'
            },
            font: {
                size: 14,
                color: '#1976D2',
                bold: true
            },
            shape: 'box',
            margin: 15,
            borderWidth: 3
        };
        nodes.add(pageHeaderNode);
        
        // Add events for this page group
        group.events.forEach((event, eventIndex) => {
            const category = EVENT_CATEGORIES[event.type] || 'Unknown';
            const color = CATEGORY_COLORS[category] || '#999999';
            
            const node = {
                id: event.id,
                label: event.type,
                level: level,
                color: {
                    background: color,
                    border: darkenColor(color, 20)
                },
                title: formatEventTooltip(event),
                category: category,
                shape: 'dot',
                size: 15
            };
            
            nodes.add(node);
            
            // Connect first event to page header
            if (eventIndex === 0) {
                edges.add({
                    id: `page_edge_${pageHeaderId}_${event.id}`,
                    from: pageHeaderId,
                    to: event.id,
                    color: '#1976D2',
                    width: 3
                });
            }
            
            // Connect events within the same page group
            if (eventIndex > 0) {
                const previousEvent = group.events[eventIndex - 1];
                edges.add({
                    id: `group_edge_${previousEvent.id}_${event.id}`,
                    from: previousEvent.id,
                    to: event.id,
                    color: '#999'
                });
            }
        });
        
        // Connect this page to the previous page
        if (groupIndex > 0) {
            const previousGroup = pageGroups[groupIndex - 1];
            const previousPageHeaderId = `page_${groupIndex - 1}`;
            
            edges.add({
                id: `nav_edge_${previousPageHeaderId}_${pageHeaderId}`,
                from: previousPageHeaderId,
                to: pageHeaderId,
                color: '#FF5722',
                width: 4,
                dashes: [10, 5],
                label: 'Navigate'
            });
        }
    });
}

// Smart Bucket View layout - groups events by semantic purpose into 8 buckets
function setSmartBucketLayout() {
    console.log("Smart Bucket layout requested");
    
    currentLayoutMode = 'smart-bucket';
    const bucketInstances = analyzeBucketGroups(events);
    currentBucketInstances = bucketInstances; // Store for export
    updateNodesWithBuckets(bucketInstances);
    updateExportButtonText();
    
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD', // Top to bottom for page navigation
                sortMethod: 'directed',
                levelSeparation: 120,
                nodeSpacing: 80,
                treeSpacing: 100,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true
            }
        },
        physics: { enabled: false },
        nodes: {
            shape: 'box',
            margin: 10,
            font: {
                size: 11,
                align: 'center',
                color: '#fff'
            },
            borderWidth: 2,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5,
                x: 2,
                y: 2
            }
        },
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 0.8 }
            },
            color: '#666',
            width: 2,
            smooth: {
                type: 'cubicBezier',
                forceDirection: 'vertical',
                roundness: 0.4
            }
        }
    };
    
    network.setOptions(options);
    
    // Fit the view
    setTimeout(() => {
        network.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }, 100);
}

// Analyze events and create chronological bucket instances
function analyzeBucketGroups(events) {
    const bucketInstances = [];
    let currentBucket = null;
    let bucketInstanceCounter = 0;
    let currentPageUrl = null;
    
    // Sort events by timestamp to ensure chronological order
    const sortedEvents = [...events].sort((a, b) => a.timeStamp - b.timeStamp);
    
    // Helper function to check if events are related
    function areEventsRelated(event1, event2) {
        // If they're the same type, they're related
        if (event1.type === event2.type) return true;
        
        // Navigation-related events are related
        const navigationEvents = ['navigation_committed', 'navigation_completed', 'tab_updated', 'tab_activated'];
        if (navigationEvents.includes(event1.type) && navigationEvents.includes(event2.type)) return true;
        
        // Focus-related events are related
        const focusEvents = ['window_focus', 'visibility_change', 'heartbeat'];
        if (focusEvents.includes(event1.type) && focusEvents.includes(event2.type)) return true;
        
        // Interaction events are related
        const interactionEvents = ['selection', 'copy', 'download_created', 'readability'];
        if (interactionEvents.includes(event1.type) && interactionEvents.includes(event2.type)) return true;
        
        return false;
    }
    
    // Helper function to check if this is a page change
    function isPageChange(event) {
        // Check for navigation events that indicate a page change
        if (event.type === 'navigation_committed' || event.type === 'tab_activated') {
            const eventUrl = event.url;
            if (eventUrl && eventUrl !== currentPageUrl) {
                currentPageUrl = eventUrl;
                return true;
            }
        }
        return false;
    }
    
    sortedEvents.forEach(event => {
        const bucketName = BUCKET_MAPPING[event.type];
        
        // Skip unmapped events or hidden buckets
        if (!bucketName || BUCKET_DISPLAY[bucketName]?.hidden) return;
        
        // Check if we need to start a new bucket instance
        const shouldCreateNewBucket = !currentBucket || 
            currentBucket.bucketName !== bucketName || 
            !areEventsRelated(currentBucket.events[currentBucket.events.length - 1], event) ||
            (bucketName === 'page_navigation' && isPageChange(event));
        
        if (shouldCreateNewBucket) {
            // Save previous bucket if it exists and has events
            if (currentBucket && currentBucket.events.length > 0) {
                currentBucket.metrics = calculateBucketMetrics(currentBucket.bucketName, currentBucket.events);
                bucketInstances.push(currentBucket);
            }
            
            // Start new bucket instance
            currentBucket = {
                id: `bucket_${bucketName}_${bucketInstanceCounter++}`,
                bucketName: bucketName,
                events: [],
                startTime: event.timeStamp,
                endTime: event.timeStamp,
                pageUrl: event.url || null // Store the page URL for navigation buckets
            };
        }
        
        // Add event to current bucket
        currentBucket.events.push(event);
        currentBucket.endTime = event.timeStamp;
    });
    
    // Add the final bucket
    if (currentBucket && currentBucket.events.length > 0) {
        currentBucket.metrics = calculateBucketMetrics(currentBucket.bucketName, currentBucket.events);
        bucketInstances.push(currentBucket);
    }
    
    return bucketInstances;
}

// Calculate bucket-specific metrics
function calculateBucketMetrics(bucketName, events) {
    const metrics = { count: events.length };
    
    switch(bucketName) {
        case 'tab_focus':
            metrics.dwellTime = events.filter(e => e.type === 'heartbeat')
                                    .reduce((sum, e) => sum + (e.secondsVisible || 15), 0);
            metrics.focusChanges = events.filter(e => e.type === 'tab_activated').length;
            break;
        case 'page_interaction':
            metrics.selections = events.filter(e => e.type === 'selection').length;
            metrics.copies = events.filter(e => e.type === 'copy').length;
            metrics.downloads = events.filter(e => e.type === 'download_created').length;
            metrics.readability = events.filter(e => e.type === 'readability').length;
            break;
        case 'resource_transfers':
            metrics.completed = events.filter(e => e.type === 'download_erased').length;
            break;
        case 'page_navigation':
            metrics.pageViews = events.filter(e => e.type === 'navigation_committed').length;
            break;
    }
    
    return metrics;
}

// Create hierarchical bucket nodes and edges
function updateNodesWithBuckets(bucketInstances) {
    nodes.clear();
    edges.clear();
    
    // Group buckets by page levels
    let currentLevel = 0;
    let currentPageUrl = null;
    let levelPositions = {}; // Track horizontal position within each level
    
    // Assign levels and positions
    bucketInstances.forEach((bucketInstance, index) => {
        const display = BUCKET_DISPLAY[bucketInstance.bucketName];
        
        // Check if this is a new page navigation
        if (bucketInstance.bucketName === 'page_navigation') {
            if (bucketInstance.pageUrl !== currentPageUrl) {
                // New page = new level going down
                currentPageUrl = bucketInstance.pageUrl;
                currentLevel++;
                levelPositions[currentLevel] = 0; // Reset horizontal position for new level
            }
        }
        
        // Assign level and horizontal position
        bucketInstance.hierarchyLevel = currentLevel;
        if (!levelPositions[currentLevel]) {
            levelPositions[currentLevel] = 0;
        }
        bucketInstance.horizontalPosition = levelPositions[currentLevel]++;
    });
    
    // Create bucket instance nodes with hierarchy
    bucketInstances.forEach((bucketInstance, index) => {
        const display = BUCKET_DISPLAY[bucketInstance.bucketName];
        const nodeSize = Math.max(30, Math.min(80, 30 + bucketInstance.events.length * 2));
        
        // Create label with page info for navigation buckets
        let label = `${display.label}\n(${bucketInstance.events.length})`;
        if (bucketInstance.bucketName === 'page_navigation' && bucketInstance.pageUrl) {
            try {
                const url = new URL(bucketInstance.pageUrl);
                const pageName = url.hostname.replace('www.', '');
                label = `${display.label}\n${pageName}\n(${bucketInstance.events.length})`;
            } catch (e) {
                // If URL parsing fails, use original label
            }
        }
        
        const node = {
            id: bucketInstance.id,
            label: label,
            color: {
                background: display.color,
                border: darkenColor(display.color, 20)
            },
            size: nodeSize,
            title: formatBucketTooltip(bucketInstance.bucketName, bucketInstance),
            bucketData: bucketInstance,
            bucketName: bucketInstance.bucketName,
            level: bucketInstance.hierarchyLevel // Use hierarchy level for layout
        };
        
        nodes.add(node);
        
        // Create edges with improved logic
        if (index > 0) {
            const previousInstance = bucketInstances[index - 1];
            const isNavigationToNewPage = bucketInstance.bucketName === 'page_navigation' && 
                                         bucketInstance.pageUrl !== previousInstance.pageUrl;
            
            const edge = {
                id: `workflow_${previousInstance.id}_${bucketInstance.id}`,
                from: previousInstance.id,
                to: bucketInstance.id,
                color: isNavigationToNewPage ? '#FF5722' : '#666',
                width: isNavigationToNewPage ? 3 : 2,
                dashes: isNavigationToNewPage ? [10, 5] : false,
                label: isNavigationToNewPage ? 'Navigate' : ''
            };
            edges.add(edge);
        }
    });
}

// Format bucket tooltip
function formatBucketTooltip(bucketName, bucketData) {
    const display = BUCKET_DISPLAY[bucketName];
    let tooltip = `<strong>${display.label} Instance</strong><br>`;
    tooltip += `Events: ${bucketData.events.length}<br>`;
    
    // Show page URL for navigation buckets
    if (bucketName === 'page_navigation' && bucketData.pageUrl) {
        const url = new URL(bucketData.pageUrl);
        tooltip += `Page: ${url.hostname}${url.pathname}<br>`;
    }
    
    if (bucketData.startTime) {
        tooltip += `Start: ${new Date(bucketData.startTime).toLocaleTimeString()}<br>`;
        tooltip += `End: ${new Date(bucketData.endTime).toLocaleTimeString()}<br>`;
        tooltip += `Duration: ${formatDuration(bucketData.endTime - bucketData.startTime)}<br>`;
    }
    
    // Add bucket-specific metrics
    if (bucketData.metrics) {
        Object.entries(bucketData.metrics).forEach(([key, value]) => {
            if (key !== 'count') {
                tooltip += `${key}: ${value}<br>`;
            }
        });
    }
    
    return tooltip;
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
document.getElementById('smart-layout').addEventListener('click', setSmartLayout);
document.getElementById('smart-bucket-layout').addEventListener('click', setSmartBucketLayout);

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initializeGraph();
    createCategoryFilters();
    updateExportButtonText();
    connect();
}); 