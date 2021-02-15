import { sendEventNotificationToContentScript } from './ipc';
import { isBlob, isObject, logError } from './functions';
import { EVENT_TYPE_DISCUSSION_LOADED, EVENT_TYPE_SESSION_LOADED, EVENT_TYPE_SOUND_PLAYED } from './constants';

// This module must be kept as short as possible, we need it to be evaluated as soon as possible.

/**
 * A RegExp for the URL that is used by Duolingo to start a new practice session.
 *
 * @type {RegExp}
 */
const NEW_SESSION_URL_REGEXP = /\/[\d]{4}-[\d]{2}-[\d]{2}\/sessions/g;

/**
 * A RegExp for the URL that is used by Duolingo to load the data related to a forum discussion.
 *
 * @type {RegExp}
 */
const FORUM_DISCUSSION_URL_REGEXP = /\/comments\/([\d]+)/g;

/**
 * @type {Function}
 */
const originalXhrOpen = XMLHttpRequest.prototype.open;

// Notifies the background script when a practice session or a forum discussion about a challenge is loaded.
XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
  const isNewSession = url.match(NEW_SESSION_URL_REGEXP);
  const isForumDiscussion = url.match(FORUM_DISCUSSION_URL_REGEXP);

  if (isNewSession || isForumDiscussion) {
    this.addEventListener('load', () => {
      try {
        const data = isObject(this.response)
          ? this.response
          : JSON.parse(this.responseText);

        if (isObject(data)) {
          if (isNewSession) {
            sendEventNotificationToContentScript(EVENT_TYPE_SESSION_LOADED, data);
          } else if (
            (data.id > 0)
            && !!data.sentence_id
            && !!data.translation_language
          ) {
            sendEventNotificationToContentScript(EVENT_TYPE_DISCUSSION_LOADED, {
              commentId: Number(data.id),
              discussionId: String(data.sentence_id).trim(),
              locale: String(data.translation_language).trim(),
            });
          }
        }
      } catch (error) {
        logError(error, 'Could not handle the session / discussion data: ');
      }
    });
  }

  return originalXhrOpen.call(this, method, url, async, user, password);
};

/**
 * Whether the "howler.js" library is used to play sounds.
 *
 * @type {boolean}
 */
let isHowlerUsed = false;

/**
 * @type {Function}
 */
let lastHowlPrototype = null;

setInterval(() => {
  if (window.Howl && (lastHowlPrototype !== window.Howl.prototype)) {
    lastHowlPrototype = window.Howl.prototype;
    const originalHowlPlay = window.Howl.prototype.play;

    // Notifies the background script when a sound is played.
    window.Howl.prototype.play = function (id) {
      try {
        if (!id) {
          const soundUrl = String(this._src || this._parent?._src || '').trim();

          if ('' !== soundUrl) {
            isHowlerUsed = true;
            sendEventNotificationToContentScript(EVENT_TYPE_SOUND_PLAYED, soundUrl);
          }
        }
      } catch (error) {
        logError(error, 'Could not handle the played sound: ');
      }

      return originalHowlPlay.call(this, id);
    };
  }
}, 50);

/**
 * @type {Function}
 */
const originalFetch = window.fetch;

/**
 * @type {Function}
 */
const originalCreateObjectUrl = URL.createObjectURL;

/**
 * A map from blobs holding sounds to the corresponding URLs.
 *
 * @type {WeakMap.<Blob, string>}
 */
let audioBlobToBlobUrl = new WeakMap();

/**
 * A map from URLs of blobs holding sounds to the original URLs of the sounds.
 *
 * @type {Object.<string, string>}
 */
let audioBlobUrlToSoundUrl = {};

// Enforce stable URLs for sound blobs, to be able to later identify them.

// Returns a stable URL for blobs holding TTS sounds.
URL.createObjectURL = function (object) {
  return isBlob(object) && audioBlobToBlobUrl.has(object)
    ? audioBlobToBlobUrl.get(object)
    : originalCreateObjectUrl.call(this, object);
}

// Make responses for TTS sounds return a stable Blob.
window.fetch = function (resource, init) {
  return originalFetch.call(this, resource, init)
    .then(response => {
      const originalResponse = response.clone();

      return response.blob()
        .then(blob => {
          if (blob.type.indexOf('audio') === 0) {
            const blobUrl = URL.createObjectURL(blob);
            audioBlobToBlobUrl.set(blob, blobUrl);
            audioBlobUrlToSoundUrl[blobUrl] = response.url;

            // By default, blob() returns a new Blob each time.
            const patchResponse = response => {
              response.blob = async () => blob;

              response.clone = function () {
                return patchResponse(Response.prototype.clone.call(this));
              };

              return response;
            };

            patchResponse(originalResponse);
          }

          return originalResponse;
        })
        .catch(() => originalResponse)
    })
}

/**
 * @type {Function}
 */
const originalAudioPlay = Audio.prototype.play;

// Notifies the background script when a sound is played.
Audio.prototype.play = function () {
  if (!isHowlerUsed) {
    try {
      sendEventNotificationToContentScript(
        EVENT_TYPE_SOUND_PLAYED,
        !audioBlobUrlToSoundUrl[this.src]
          ? this.src
          : audioBlobUrlToSoundUrl[this.src]
      );
    } catch (error) {
      logError(error, 'Could not handle the played audio: ');
    }
  }

  return originalAudioPlay.call(this);
};
