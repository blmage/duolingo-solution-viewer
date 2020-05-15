var script = document.createElement('script');
script.src = chrome.runtime.getURL('src/page.js');
script.async = false;
(document.head || document.documentElement).appendChild(script);
