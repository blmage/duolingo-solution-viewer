import { setupContentScriptBridge } from 'duo-toolbox/extension/ipc';
import { ACTION_TYPES, UI_EVENT_TYPES } from './ipc';

const observerScript = document.createElement('script');
observerScript.src = chrome.runtime.getURL('src/observer.js');
observerScript.type = 'text/javascript';
(document.head || document.documentElement).appendChild(observerScript);

const uiScript = document.createElement('script');
uiScript.src = chrome.runtime.getURL('src/ui.js');
uiScript.type = 'text/javascript';
(document.head || document.documentElement).appendChild(uiScript);

setupContentScriptBridge(ACTION_TYPES, UI_EVENT_TYPES, []);
