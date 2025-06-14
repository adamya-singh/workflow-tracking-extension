// Listen for parsing requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'parse') {
    try {
      // Create DOM parser for the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(message.html, 'text/html');
      
      // Use Readability to parse the document
      const reader = new Readability(doc, {
        debug: false,
        charThreshold: 500
      });
      
      const article = reader.parse();
      
      if (article) {
        // Create hash for deduplication
        const hash = btoa(article.title + article.textContent.substring(0, 100)).substring(0, 16);
        
        const result = {
          title: article.title,
          byline: article.byline,
          excerpt: article.excerpt,
          textContent: article.textContent,
          length: article.length,
          siteName: article.siteName,
          publishedTime: article.publishedTime,
          hash: hash,
          wordCount: article.textContent.split(/\s+/).length
        };
        
        sendResponse(result);
      } else {
        sendResponse(null);
      }
    } catch (error) {
      console.error('Readability parsing error:', error);
      sendResponse(null);
    }
  }
}); 