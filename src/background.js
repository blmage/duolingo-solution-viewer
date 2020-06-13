import { get } from 'lodash';
import { it } from 'param.macro';
import Dexie from 'dexie';
import { isEmptyObject, isObject, runPromiseForEffects } from './functions';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS,
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES,
  EXTENSION_CODE,
} from './constants';

const database = new Dexie(EXTENSION_CODE);

/**
 * @param {string[]} fields A list of field names.
 * @returns {string} The definition of the compound index based on the given fields.
 */
function getCompoundIndex(fields) {
  return `[${fields.join('+')}]`;
}

const TABLE_DISCUSSION_COMMENTS = 'discussion_comments';
const TABLE_COMMENT_CHALLENGES = 'comment_challenges';

const FIELD_DISCUSSION_ID = 'discussion_id';
const FIELD_COMMENT_ID = 'comment_id';
const FIELD_CHALLENGE = 'challenge';
const FIELD_INVERTED_SIZE = 'inverted_size';
const FIELD_LAST_ACCESS_AT = 'last_access_at';
const INDEX_CHALLENGE_PRIORITY = getCompoundIndex([ FIELD_LAST_ACCESS_AT, FIELD_INVERTED_SIZE ]);

/**
 * The maximum (serialized) size for storable challenges.
 *
 * @type {number}
 */
const MAX_CHALLENGE_SIZE = 1024 * 1024;

database.version(1)
  .stores({
    [TABLE_DISCUSSION_COMMENTS]: [
      FIELD_DISCUSSION_ID,
    ].join(','),
    [TABLE_COMMENT_CHALLENGES]: [
      FIELD_COMMENT_ID,
      FIELD_INVERTED_SIZE,
      FIELD_LAST_ACCESS_AT,
      INDEX_CHALLENGE_PRIORITY,
    ].join(','),
  });

/**
 * @returns {number} The index of the current 30-minute slice of time.
 */
function getCurrentAccessAt() {
  return Math.floor((new Date()).getTime() / 1000 / 60 / 30);
}

/**
 * @param {string} table The table in which to insert/update the value.
 * @param {object} value The value to insert/update in the table.
 * @returns {Promise}
 * A promise which will fail or succeed depending on the result of the action.
 * If an error occurs, old challenges will be purged before the action is retried once.
 */
async function putWithRetry(table, value) {
  try {
    await database[table].put(value);
  } catch (error) {
    let purgedSize = 0;

    const purgedChallenges = await database[TABLE_COMMENT_CHALLENGES]
      .orderBy(INDEX_CHALLENGE_PRIORITY)
      .until(challenge => {
        purgedSize += MAX_CHALLENGE_SIZE - (challenge[FIELD_INVERTED_SIZE] || MAX_CHALLENGE_SIZE);
        return (purgedSize >= MAX_CHALLENGE_SIZE);
      }, true)
      .toArray();

    await database[TABLE_COMMENT_CHALLENGES]
      .bulkDelete(purgedChallenges.map(it[FIELD_COMMENT_ID]));

    await database[table].put(value);
  }
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
  let commentId = await database[TABLE_DISCUSSION_COMMENTS].get(discussionId);

  if (!commentId) {
    const response = await fetch(getDiscussionCommentDataUrl(discussionId, fromLanguage, toLanguage));
    const data = await response.json();
    const commentId = Number(get(data, [ 'comment', 'id' ]));

    if (commentId > 0) {
      await putWithRetry(TABLE_DISCUSSION_COMMENTS, {
        [FIELD_COMMENT_ID]: commentId,
        [FIELD_DISCUSSION_ID]: discussionId,
      });

      return commentId;
    }

    throw new Error(`There is no comment for discussion #${discussionId}.`);
  }
}

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {import('./page.js').Challenge} challenge The challenge referred to by the given forum discussion.
 * @returns {Promise} A promise for the result of the update.
 */
async function updateDiscussionChallenge(discussionId, challenge) {
  const commentId = await getDiscussionCommentId(
    discussionId,
    challenge.fromLanguage,
    challenge.toLanguage
  );

  const size = JSON.stringify(challenge).length;

  if (size > MAX_CHALLENGE_SIZE) {
    throw new Error(`The discussion #${discussionId} has a challenge whose serialized size exceeds the limit.`);
  }

  await putWithRetry(TABLE_COMMENT_CHALLENGES, {
    [FIELD_COMMENT_ID]: commentId,
    [FIELD_CHALLENGE]: challenge,
    [FIELD_INVERTED_SIZE]: MAX_CHALLENGE_SIZE - size,
    [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
  });
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @returns {Promise} A promise for the challenge which is referred to by the given forum comment, if any.
 */
async function getCommentChallenge(commentId) {
  const result = await database[TABLE_COMMENT_CHALLENGES].get(commentId);

  if (isObject(result)) {
    try {
      await database[TABLE_COMMENT_CHALLENGES].update(
        commentId,
        { [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt() }
      );
    } catch (error) {
      // Ignore the error. We only want to purge data when nothing is waiting for a result.
    }

    return result[FIELD_CHALLENGE];
  }

  throw new Error(`There is no challenge for comment #${commentId}.`);
}

// Clean the local storage when upgrading from version 2.0.1.
chrome.storage.local.get(null, values => {
  if (Object.keys(values || {}).some(it.indexOf('discussion_comment_id') >= 0)) {
    chrome.storage.local.clear();
  }
});

database.open().then(() => {
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
      if (isObject(message.value) && !isEmptyObject(message.value)) {
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
});
