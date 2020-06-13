import { isString } from 'lodash';
import { isObject } from './functions';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS,
  ACTION_TYPES,
  MESSAGE_TYPE_ACTION_REQUEST, MESSAGE_TYPE_ACTION_RESULT,
  SOLUTION_ICON_URL_META_NAME,
} from './constants';

const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/page.js');
script.async = false;
(document.head || document.documentElement).appendChild(script);

const solutionIconMeta = document.createElement('meta');
solutionIconMeta.name = SOLUTION_ICON_URL_META_NAME;
solutionIconMeta.content = chrome.runtime.getURL('assets/icon_solution.svg');
(document.head || document.documentElement).appendChild(solutionIconMeta);


/**
 * Sends a message to the background script.
 *
 * @param {string} type The type of the message.
 * @param {*} value The payload of the message.
 * @returns {Promise} A promise for the result of processing the message.
 */
async function sendMessageToBackground(type, value) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type, value },
      result => {
        if (!chrome.runtime.lastError && result && (ACTION_RESULT_SUCCESS === result.type)) {
          resolve(result.value || null);
        } else {
          reject();
        }
      });
  });
}

window.addEventListener('message', event => {
  if (
    (event.source === window)
    && isObject(event.data)
    && (MESSAGE_TYPE_ACTION_REQUEST === event.data.type)
  ) {
    let resultPromise;
    const action = event.data.action || null;

    if (isString(action) && ACTION_TYPES.indexOf(action) >= 0) {
      resultPromise = sendMessageToBackground(action, event.data.value || null)
    } else {
      resultPromise = new Promise((resolve, reject) => reject());
    }

    resultPromise.then(value => {
      event.source.postMessage({
        type: MESSAGE_TYPE_ACTION_RESULT,
        action,
        result: ACTION_RESULT_SUCCESS,
        value,
      })
    }).catch(() => {
      event.source.postMessage({
        type: MESSAGE_TYPE_ACTION_RESULT,
        action,
        result: ACTION_RESULT_FAILURE,
      })
    });
  }
});
