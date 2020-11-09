import {
  ACTION_RESULT_SUCCESS,
  MESSAGE_TYPE_ACTION_REQUEST,
  MESSAGE_TYPE_ACTION_RESULT,
  MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
} from './constants';

/**
 * Sends an action request from a UI script to the content scripts.
 *
 * @param {string} action The action key.
 * @param {*} value The action payload.
 * @returns {Promise} A promise for the result of the action.
 */
export async function sendActionRequestToContentScript(action, value) {
  return new Promise((resolve, reject) => {
    const resultListener = event => {
      if (
        (event.source === window)
        && event.data
        && (MESSAGE_TYPE_ACTION_RESULT === event.data.type)
        && (action === event.data.action)
      ) {
        if (event.data.result === ACTION_RESULT_SUCCESS) {
          resolve(event.data.value || null);
        } else {
          reject();
        }

        event.stopPropagation();
        window.removeEventListener('message', resultListener);
      }
    };

    window.addEventListener('message', resultListener);

    window.postMessage({
      type: MESSAGE_TYPE_ACTION_REQUEST,
      action,
      value,
    }, '*');
  });
}

/**
 * Sends an event notification from a UI script to the content scripts.
 *
 * @param {string} event The event key.
 * @param {*} value The event payload.
 */
export function sendEventNotificationToContentScript(event, value) {
  window.postMessage({
    type: MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
    event,
    value,
  }, '*');
}


/**
 * Sends a message from a content script to the background scripts.
 *
 * @param {object} data The payload of the message.
 * @returns {Promise} A promise for the result of processing the message.
 */
export async function sendMessageToBackground(data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(data, result => {
      if (!chrome.runtime.lastError) {
        resolve(result);
      } else {
        reject();
      }
    });
  });
}
