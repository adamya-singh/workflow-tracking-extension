// Listen for copy events
document.addEventListener('copy', (event) => {
    const text = event.clipboardData.getData('text');
    chrome.runtime.sendMessage({
        type: 'copy',
        text
    });
});

// Listen for selection changes
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
        chrome.runtime.sendMessage({
            type: 'selection',
            text: selection.toString()
        });
    }
});

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
    chrome.runtime.sendMessage({
        type: 'visibility_change',
        state: document.visibilityState
    });
});

// Listen for focus/blur events
window.addEventListener('focus', () => {
    chrome.runtime.sendMessage({
        type: 'window_focus',
        state: 'focused'
    });
});

window.addEventListener('blur', () => {
    chrome.runtime.sendMessage({
        type: 'window_focus',
        state: 'blurred'
    });
});

// Log when content script is loaded
chrome.runtime.sendMessage({
    type: 'content_script_loaded',
    url: window.location.href
});

// Log any errors in the content script
window.onerror = (message, source, lineno, colno, error) => {
    chrome.runtime.sendMessage({
        type: 'content_script_error',
        error: message,
        source,
        lineno,
        colno,
        stack: error?.stack
    });
};

// Placeholder for Readability (requires library import)
const article = new Readability(document.cloneNode(true)).parse();
console.log({ title: article.title, byline: article.byline, excerpt: article.excerpt });