document.getElementById('open-stream').addEventListener('click', () => {
    chrome.tabs.create({ url: 'stream.html' });
});

document.getElementById('open-graph').addEventListener('click', () => {
    chrome.tabs.create({ url: 'graph.html' });
}); 