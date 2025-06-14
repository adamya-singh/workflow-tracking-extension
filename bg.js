// Create the off-screen document at startup to handle heavy parsing tasks
chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Heavy parsing off UI thread'
  }).catch(error => {
    console.error('Failed to create off-screen document:', error);
  });
  
  // Maintain list of connected stream pages
  let streamPorts = [];
  
  // Handle stream page connections
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "event-stream") {
      streamPorts.push(port);
      port.onDisconnect.addListener(() => {
        streamPorts = streamPorts.filter(p => p !== port);
      });
    }
  });
  
  // Broadcast event to all connected stream pages
  function broadcastEvent(event) {
    streamPorts.forEach(port => {
      try {
        port.postMessage(event);
      } catch (e) {
        // Port might be disconnected
      }
    });
  }
  
  // Listener for web navigation events
  chrome.webNavigation.onCommitted.addListener(details => {
    const { tabId, url, transitionType, timeStamp } = details;
    const searchQuery = url.includes('q=') ? new URL(url).searchParams.get('q') : null;
    const event = {
      type: 'navigation',
      timeStamp,
      tabId,
      url,
      transitionType,
      searchQuery
    };
    console.log(event);
    broadcastEvent(event);
  });
  
  // Listener for tab activation events
  chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
      const event = {
        type: 'focus',
        timeStamp: Date.now(),
        tabId: activeInfo.tabId,
        url: tab.url
      };
      console.log(event);
      broadcastEvent(event);
    });
  });
  
  // Listener for download creation events
  chrome.downloads.onCreated.addListener(downloadItem => {
    const event = {
      type: 'download',
      timeStamp: Date.now(),
      filename: downloadItem.filename,
      url: downloadItem.url,
      mime: downloadItem.mime
    };
    console.log(event);
    broadcastEvent(event);
  });
  
  // Listener for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'html') {
      // Forward the HTML to the off-screen document for parsing
      chrome.runtime.sendMessage({ type: 'parse', html: message.html }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to off-screen document:', chrome.runtime.lastError);
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
    }
  });