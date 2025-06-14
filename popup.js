document.getElementById('open-stream').addEventListener('click', () => {
    chrome.tabs.create({ url: 'stream.html' });
}); 