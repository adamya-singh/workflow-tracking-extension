document.addEventListener('selectionchange', () => {
    const selection = window.getSelection().toString();
    if (selection) console.log({ timeStamp: Date.now(), url: location.href, selectedText: selection });
  });
  
  document.addEventListener('copy', event => {
    const text = event.clipboardData.getData('text/plain');
    console.log({ timeStamp: Date.now(), url: location.href, selectedText: text });
  });
  
  // Placeholder for Readability (requires library import)
  const article = new Readability(document.cloneNode(true)).parse();
  console.log({ title: article.title, byline: article.byline, excerpt: article.excerpt });