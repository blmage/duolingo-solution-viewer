var script = document.createElement('script');
script.src = chrome.runtime.getURL('src/page.js');
script.async = false;
(document.head || document.documentElement).appendChild(script);

var solutionIconMeta = document.createElement('meta');
solutionIconMeta.name = '_duo-sv_-solution-icon-url';
solutionIconMeta.content = chrome.runtime.getURL('assets/icon_solution.svg');
(document.head || document.documentElement).appendChild(solutionIconMeta);
