import { sendMessageToBackground } from './ipc';
import { isObject, runPromiseForEffects } from './functions';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS,
  ACTION_TYPES,
  EVENT_TYPES,
  MESSAGE_TYPE_ACTION_REQUEST,
  MESSAGE_TYPE_ACTION_RESULT,
  MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
} from './constants';

const observerScript = document.createElement('script');
observerScript.src = chrome.runtime.getURL('src/observer.js');
observerScript.type = 'text/javascript';
(document.head || document.documentElement).appendChild(observerScript);

const uiScript = document.createElement('script');
uiScript.src = chrome.runtime.getURL('src/ui.js');
uiScript.type = 'text/javascript';
(document.head || document.documentElement).appendChild(uiScript);

window.addEventListener('message', event => {
  if ((event.source === window) && isObject(event.data)) {
    if (MESSAGE_TYPE_ACTION_REQUEST === event.data.type) {
      let resultPromise;
      const actionType = event.data.action || null;

      if (ACTION_TYPES.indexOf(actionType) >= 0) {
        resultPromise = sendMessageToBackground(event.data)
          .then(result => {
            if (!isObject(result) || (ACTION_RESULT_SUCCESS !== result.type)) {
              throw new Error();
            }

            return result.value;
          });
      } else {
        resultPromise = new Promise((resolve, reject) => reject());
      }

      resultPromise.then(value => {
        event.source.postMessage({
          type: MESSAGE_TYPE_ACTION_RESULT,
          action: actionType,
          result: ACTION_RESULT_SUCCESS,
          value,
        }, '*')
      }).catch(() => {
        event.source.postMessage({
          type: MESSAGE_TYPE_ACTION_RESULT,
          action: actionType,
          result: ACTION_RESULT_FAILURE,
        }, '*')
      });
    } else if (MESSAGE_TYPE_UI_EVENT_NOTIFICATION === event.data.type) {
      const eventType = event.data.event || null;

      if (EVENT_TYPES.indexOf(eventType) >= 0) {
        runPromiseForEffects(sendMessageToBackground(event.data));
      }
    }
  }
});
