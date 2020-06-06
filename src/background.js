import { get, isEmpty, isPlainObject } from 'lodash';
import { StorageLRU } from 'storage-lru';
import { runPromiseForEffects } from './functions';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS, ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES,
  EXTENSION_PREFIX,
} from './constants';

const storage = new StorageLRU(
  {
    getItem(key, callback) {
      chrome.storage.local.get(
        key,
        ({ [key]: value }) => callback(chrome.runtime.lastError, value)
      );
    },
    setItem(key, value, callback) {
      chrome.storage.local.set(
        { [key]: value },
        () => callback(chrome.runtime.lastError)
      );
    },
    removeItem(key, callback) {
      chrome.storage.local.remove(key, () => callback(chrome.runtime.lastError));
    },
    keys(count, callback) {
      chrome.storage.local.get(
        null,
        values => callback(chrome.runtime.lastError, Object.keys(values || {}))
      );
    },
  },
  {
    keyPrefix: EXTENSION_PREFIX,
    maxPurgeAttempts: 3,
    purgeLoadIncrease: 100,
  }
);

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @returns {string} The storage key under which to store the ID of the corresponding comment.
 */
function getDiscussionCommentIdStorageKey(discussionId) {
  return `discussion_comment_id_${discussionId}`;
}

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {string} The URL usable to fetch data about the comment corresponding to the given forum discussion.
 */
function getDiscussionCommentDataUrl(discussionId, fromLanguage, toLanguage) {
  return `https://www.duolingo.com/sentence/${discussionId}?learning_language=${toLanguage}&ui_language=${fromLanguage}`;
}

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Promise} A promise for the ID of the comment corresponding to the given forum discussion.
 */
async function getDiscussionCommentId(discussionId, fromLanguage, toLanguage) {
  const storageKey = getDiscussionCommentIdStorageKey(discussionId);

  return new Promise((resolve, reject) => {
    storage.getItem(storageKey, {}, (error, value) => {
      const commentId = Number(value);

      if (error || !(commentId > 0)) {
        fetch(getDiscussionCommentDataUrl(discussionId, fromLanguage, toLanguage))
          .then(response => response.json())
          .then(data => Number(get(data, [ 'comment', 'id' ])))
          .then(commentId => {
            if (commentId > 0) {
              storage.setItem(storageKey, commentId, {
                priority: 1, // last to purge
                cacheControl: 'max-age=315360000', // 10 years
              }, () => {
                resolve(commentId);
              });
            } else {
              reject();
            }
          })
          .catch(() => reject());
      } else {
        resolve(commentId);
      }
    })
  });
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @returns {string} The storage key under which to store the challenge referred to by the comment.
 */
function getCommentChallengeStorageKey(commentId) {
  return `comment_challenge_${commentId}`;
}

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {import('./page.js').Challenge} challenge The challenge referred to by the given forum discussion.
 * @returns {Promise} A promise for the result of the update.
 */
async function updateDiscussionChallenge(discussionId, challenge) {
  return new Promise((resolve, reject) => {
    getDiscussionCommentId(discussionId, challenge.fromLanguage, challenge.toLanguage)
      .then(commentId => {
        const storageKey = getCommentChallengeStorageKey(commentId);

        storage.setItem(storageKey, challenge, {
          json: true,
          priority: 3, // normal
          cacheControl: 'max-age=31536000', // 1 year
        }, () => resolve());
      })
      .catch(() => reject());
  });
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @returns {Promise} A promise for the challenge which is referred to by the given forum comment, if any.
 */
async function getCommentChallenge(commentId) {
  return new Promise((resolve, reject) => {
    const storageKey = getCommentChallengeStorageKey(commentId);

    storage.getItem(storageKey, { json: true }, (error, challenge) => {
      if (error || !isPlainObject(challenge) || isEmpty(challenge)) {
        reject();
      } else {
        resolve(challenge);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (ACTION_TYPE_GET_COMMENT_CHALLENGE === message.type) {
    if (message.value > 0) {
      getCommentChallenge(message.value)
        .then(value => sendResponse({ type: ACTION_RESULT_SUCCESS, value }))
        .catch(() => sendResponse({ type: ACTION_RESULT_FAILURE }));
    } else {
      sendResponse({ type: ACTION_RESULT_FAILURE });
    }
  } else if (ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES === message.type) {
    if (isPlainObject(message.value) && !isEmpty(message.value)) {
      // Don't make the content script/page script wait for a result it doesn't care about.
      sendResponse({ type: ACTION_RESULT_SUCCESS });

      runPromiseForEffects(
        Promise.all(
          Object.entries(message.value)
            .map(([ discussionId, challenge ]) =>
              updateDiscussionChallenge(discussionId, challenge)
            )
        )
      );
    } else {
      sendResponse({ type: ACTION_RESULT_FAILURE });
    }
  } else {
    sendResponse({ type: ACTION_RESULT_FAILURE });
  }

  return true;
});
