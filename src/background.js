import 'core-js/features/array/flat-map';
import 'core-js/features/string/match-all';
import { _, it } from 'param.macro';
import sleep from 'sleep-promise';
import wrapFetchWithRetry from 'fetch-retry';
import Dexie from 'dexie';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS,
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE,
  CHALLENGE_TYPE_LISTENING,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_TRANSLATION,
  EVENT_TYPE_SESSION_LOADED,
  EVENT_TYPE_SOUND_PLAYED,
  EXTENSION_CODE,
  MESSAGE_TYPE_ACTION_REQUEST,
  MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
  RESULT_CORRECT,
} from './constants';

import {
  isArray,
  isNumber,
  isObject,
  isString,
  maxOf,
  minBy,
  normalizeString,
  runPromiseForEffects,
} from './functions';

import * as Challenge from './challenges';
import * as Solution from './solutions';

/**
 * @param {string[]} fields A list of field names.
 * @returns {string} The definition of the compound index based on the given fields.
 */
function getCompoundIndex(fields) {
  return `[${fields.join('+')}]`;
}

const TABLE_DISCUSSION_COMMENTS = 'discussion_comments';
const TABLE_COMMENT_CHALLENGES = 'comment_challenges';

const FIELD_CHALLENGE = 'challenge';
const FIELD_COMMENT_ID = 'comment_id';
const FIELD_DISCUSSION_ID = 'discussion_id';
const FIELD_INVERTED_SIZE = 'inverted_size';
const FIELD_LAST_ACCESS_AT = 'last_access_at';
const FIELD_USER_REFERENCE = 'user_reference';

const INDEX_CHALLENGE_PRIORITY = getCompoundIndex([ FIELD_LAST_ACCESS_AT, FIELD_INVERTED_SIZE ]);

/**
 * An arbitrary maximum (serialized) size for storable challenges.
 *
 * @type {number}
 */
const MAX_CHALLENGE_SIZE = 1024 * 1024;

const database = new Dexie(EXTENSION_CODE);

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
 * A wrapper around fetch which retries twice when encountering an error.
 *
 * @type {Function}
 * @param {string} url The URL to fetch.
 * @param {?object} options Optional parameters such as method, headers, etc.
 * @returns {Promise} A promise for the result of the request.
 */
const fetchWithRetry = wrapFetchWithRetry(fetch, {
  retries: 2,
  retryDelay: 1500,
  retryOn: [ 403, 500, 503, 504 ],
});

/**
 * @param {string} table The table in which to insert/update the value.
 * @param {object} value The value to insert/update in the table.
 * @returns {Promise<void>}
 * A promise which will fail or succeed depending on the result of the action.
 * If a quota error occurs, old challenges will be purged before the action is retried once.
 */
async function putWithRetry(table, value) {
  try {
    await database[table].put(value);
  } catch (error) {
    if ((error.name === 'QuotaExceededError') || (error.inner?.name === 'QuotaExceededError')) {
      let purgedSize = 0;

      const checkPurgedSize = challenge => {
        purgedSize += MAX_CHALLENGE_SIZE - (challenge[FIELD_INVERTED_SIZE] || MAX_CHALLENGE_SIZE);
        return (purgedSize >= MAX_CHALLENGE_SIZE);
      };

      const purgedIds = await database[TABLE_COMMENT_CHALLENGES]
        .orderBy(INDEX_CHALLENGE_PRIORITY)
        .until(checkPurgedSize, true)
        .toArray()
        .map(it[FIELD_COMMENT_ID]);

      await database[TABLE_COMMENT_CHALLENGES].bulkDelete(purgedIds);
      await database[table].put(value);
    }
  }
}

/**
 * @param {object} sender The sender of a message.
 * @returns {string} A unique ID for the given sender.
 */
function getSenderId(sender) {
  const senderTabId = String(sender.tab?.id || 'global');
  const senderFrameId = String(sender.frameId || 'main');
  return `${senderTabId}-${senderFrameId}`;
}

/**
 * The list of challenges for each practice session running in a tab.
 *
 * @type {import('./challenges').Challenge[]}
 */
const sessionChallenges = [];

/**
 * The current listening challenge for each practice session running in a tab.
 *
 * @type {object<string, Challenge|null>}
 */
const sessionCurrentListeningChallenges = {};

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {string} The URL usable to fetch data about the first comment from the given forum discussion.
 */
function getDiscussionCommentDataUrl(discussionId, fromLanguage, toLanguage) {
  return `https://www.duolingo.com/sentence/${discussionId}?learning_language=${toLanguage}&ui_language=${fromLanguage}`;
}

/**
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Promise<number>} A promise for the ID of the first comment from the given forum discussion.
 */
async function getDiscussionCommentId(discussionId, fromLanguage, toLanguage) {
  const result = await database[TABLE_DISCUSSION_COMMENTS].get(discussionId);

  if (!isObject(result)) {
    const response = await fetchWithRetry(
      getDiscussionCommentDataUrl(
        discussionId,
        fromLanguage,
        toLanguage
      ),
      { credentials: 'include' }
    );

    const { comment: { id: commentId } = {} } = await response.json();

    if (isNumber(commentId) && (commentId > 0)) {
      await putWithRetry(TABLE_DISCUSSION_COMMENTS, {
        [FIELD_COMMENT_ID]: commentId,
        [FIELD_DISCUSSION_ID]: discussionId,
      });

      return commentId;
    }

    throw new Error(`There is no comment for discussion #${discussionId}.`);
  }

  return result[FIELD_COMMENT_ID];
}

/**
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @returns {Promise<number>} A promise for the ID of the first forum comment about the given challenge.
 */
async function getChallengeCommentId(challenge) {
  if (challenge.commentId > 0) {
    return challenge.commentId;
  }

  if (!challenge.discussionId) {
    throw new Error('The challenge is not associated to a discussion.');
  }

  challenge.commentId = await getDiscussionCommentId(
    challenge.discussionId,
    challenge.fromLanguage,
    challenge.toLanguage
  );

  return challenge.commentId;
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @returns {Promise<Challenge>}
 * A promise for the challenge which is referred to by the given forum comment,
 * and the last user reference that it was associated to.
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

    return {
      commentId,
      challenge: result[FIELD_CHALLENGE],
      userReference: result[FIELD_USER_REFERENCE],
    };
  }

  throw new Error(`There is no challenge for comment #${commentId}.`);
}

/**
 * Registers the relation between a challenge and the corresponding first forum comment.
 *
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerCommentChallenge(challenge) {
  const commentId = await getChallengeCommentId(challenge);
  const challengeSize = JSON.stringify(challenge).length;

  if (challengeSize > MAX_CHALLENGE_SIZE) {
    throw new Error(
      `The discussion #${challenge.discussionId} has a challenge whose serialized size exceeds the limit.`
    );
  }

  await putWithRetry(TABLE_COMMENT_CHALLENGES, {
    [FIELD_COMMENT_ID]: commentId,
    [FIELD_CHALLENGE]: challenge,
    [FIELD_INVERTED_SIZE]: MAX_CHALLENGE_SIZE - challengeSize,
    [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
  });
}

/**
 * Registers the relations between a set of challenges and the corresponding first forum comments.
 *
 * @param {import('./challenges').Challenge[]} challenges A set of challenges.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerCommentChallenges(challenges) {
  return Promise.all(
    challenges.map(
      (challenge, index) => sleep(4500 * index).then(() => registerCommentChallenge(challenge))
    )
  );
}

/**
 * Registers a new user reference for a challenge.
 *
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @param {string} reference A user reference.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerChallengeUserReference(challenge, reference) {
  const commentId = await getChallengeCommentId(challenge);

  await database[TABLE_COMMENT_CHALLENGES].update(
    commentId,
    {
      [FIELD_USER_REFERENCE]: reference,
      [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
    }
  );
}

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The first challenge of the given type and session to match the given predicate.
 */
function findSessionChallengeOfType(sessionId, challengeType, predicate) {
  return !isArray(sessionChallenges[sessionId])
    ? null
    : sessionChallenges[sessionId].find(
      challenge => Challenge.isOfType(challenge, challengeType) && predicate(challenge)
    );
}

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The challenges of the given type and session that match the given predicate.
 */
function findSessionChallengesOfType(sessionId, challengeType, predicate) {
  return !isArray(sessionChallenges[sessionId])
    ? []
    : sessionChallenges[sessionId].filter(
      challenge => Challenge.isOfType(challenge, challengeType) && predicate(challenge)
    );
}

/**
 * Parses and registers the challenges of a new practice session that are relevant to the extension.
 *
 * @param {string} sessionId A session ID.
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerUiChallenges(sessionId, uiChallenges, fromLanguage, toLanguage) {
  sessionChallenges[sessionId] = Challenge.parseUiChallenges(uiChallenges, fromLanguage, toLanguage);

  await registerCommentChallenges(
    sessionChallenges[sessionId].filter(Challenge.isOfType(_, CHALLENGE_TYPE_TRANSLATION))
  );
}

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current translation challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCurrentTranslationChallengeRequest(senderId, data, sendResult) {
  if (
    isObject(data)
    && isString(data.statement)
    && isArray(sessionChallenges[senderId])
  ) {
    const statement = normalizeString(data.statement);
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer);

    let challenge = findSessionChallengeOfType(
      senderId,
      CHALLENGE_TYPE_TRANSLATION,
      statement === it.statement
    );

    if (!challenge) {
      challenge = findSessionChallengeOfType(
        senderId,
        CHALLENGE_TYPE_NAMING,
        statement.indexOf(it.statement) >= 0
      );
    }

    if (!isObject(challenge)) {
      return;
    }

    Challenge.addSimilarityScores(challenge, userAnswer);

    sendResult(challenge);

    if ('' !== userAnswer) {
      await registerChallengeUserReference(challenge, userAnswer);
    }
  }
}

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current listening challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCurrentListeningChallengeRequest(senderId, data, sendResult) {
  if (isObject(data)) {
    let challenges;
    let predicate = () => true;
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer);

    if (isString(data.solutionTranslation)) {
      const solutionTranslation = normalizeString(data.solutionTranslation);
      predicate = solutionTranslation === it.solutionTranslation;
    }

    challenges = findSessionChallengesOfType(senderId, CHALLENGE_TYPE_LISTENING, predicate);

    if (0 === challenges.length) {
      return;
    }

    let challenge = (1 === challenges.length)
      ? challenges.pop()
      : (
        sessionCurrentListeningChallenges[senderId]
        && challenges.find(Challenge.isSameListeningChallenge(_, sessionCurrentListeningChallenges[senderId]))
      );

    if (!isObject(challenge)) {
      return;
    }

    Challenge.addSimilarityScores(challenge, userAnswer);

    const result = { challenge };

    if (('' !== userAnswer) && (RESULT_CORRECT === data.result)) {
      const bestScore = maxOf(challenge.solutions, it.score);
      const matchingOptions = challenge.matchingData.matchingOptions;

      result.correctionDiff = minBy(
        challenge.solutions
          .filter(bestScore === it.score)
          .flatMap(Solution.getBestMatchingVariationsForAnswer(_, userAnswer, matchingOptions))
          .map(Solution.getVariationDiffWithAnswer(_, userAnswer, matchingOptions))
          .filter(isArray),
        it.length
      );
    }

    sendResult(result);
  }
}

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the updated challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCurrentChallengeUserReferenceUpdateRequest(senderId, data, sendResult) {
  if (
    isObject(data)
    && isString(data.key)
    && isString(data.userReference)
    && ('' !== data.userReference.trim())
  ) {
    const userReference = data.userReference.trim();

    const challenge = findSessionChallengeOfType(
      senderId,
      CHALLENGE_TYPE_TRANSLATION,
      Challenge.getUniqueKey(_) === data.key
    );

    if (isObject(challenge)) {
      await registerChallengeUserReference(challenge, userReference);
      Challenge.addSimilarityScores(challenge, userReference);
      sendResult({ challenge, userReference });
    }
  }
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @param {Function} sendResult A callback usable to send the corresponding challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the request.
 */
async function handleCommentChallengeRequest(commentId, sendResult) {
  if (commentId > 0) {
    const result = await getCommentChallenge(commentId);

    if (isString(result.userReference) && ('' !== result.userReference)) {
      Challenge.addSimilarityScores(result.challenge, result.userReference);
    } else {
      Challenge.addMatchingData(result.challenge);
    }

    sendResult(result);
  }
}

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the updated challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCommentChallengeUserReferenceUpdateRequest(data, sendResult) {
  if (
    isObject(data)
    && (data.commentId > 0)
    && isString(data.userReference)
    && ('' !== data.userReference.trim())
  ) {
    const userReference = data.userReference.trim();
    const { challenge } = await getCommentChallenge(data.commentId);
    await registerChallengeUserReference(challenge, userReference);
    Challenge.addSimilarityScores(challenge, userReference);
    sendResult({ challenge, userReference });
  }
}

/**
 * @param {string} action The action type.
 * @param {*} data The action payload.
 * @param {object} sender The sender of the action request.
 * @param {Function} sendResponse A callback usable to send a response to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleActionRequest(action, data, sender, sendResponse) {
  let isResponseSent = false;

  try {
    const sendResult = result => {
      isResponseSent = true;
      sendResponse({ type: ACTION_RESULT_SUCCESS, value: result });
    };

    switch (action) {
      case ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE:
        await handleCurrentTranslationChallengeRequest(getSenderId(sender), data, sendResult);
        break;
      case ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE:
        await handleCurrentListeningChallengeRequest(getSenderId(sender), data, sendResult);
        break;
      case ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE:
        await handleCurrentChallengeUserReferenceUpdateRequest(getSenderId(sender), data, sendResult);
        break;
      case ACTION_TYPE_GET_COMMENT_CHALLENGE:
        await handleCommentChallengeRequest(data, sendResult);
        break;
      case ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE:
        await handleCommentChallengeUserReferenceUpdateRequest(data, sendResult)
        break;
    }

    if (!isResponseSent) {
      throw new Error(`Could not handle action: "${data.action}".`);
    }
  } catch (error) {
    if (!isResponseSent) {
      sendResponse({ type: ACTION_RESULT_FAILURE });
    }
  }
}

/**
 * Parses and registers challenge data when a practice session is loaded.
 *
 * @param {string} senderId The ID of the sender of the event notification.
 * @param {object} data The event payload.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
async function handleSessionLoadedEvent(senderId, data) {
  if (isObject(data)) {
    const metaData = isObject(data.metadata) ? data.metadata : {};
    const baseChallenges = isArray(data.challenges) ? data.challenges : [];
    const adaptiveChallenges = isArray(data.adaptiveChallenges) ? data.adaptiveChallenges : [];

    await registerUiChallenges(
      senderId,
      baseChallenges.concat(adaptiveChallenges),
      String(metaData.ui_language || metaData.from_language || data.fromLanguage || '').trim(),
      String(metaData.language || data.learningLanguage || '').trim()
    );
  }
}

/**
 * Registers the current listening challenge when a corresponding TTS media is played.
 *
 * @param {string} senderId The ID of the sender of the event notification.
 * @param {object} data The event payload.
 */
function handleSoundPlayedEvent(senderId, data) {
  if (isString(data)) {
    const mediaUrl = data.trim();

    if ('' !== mediaUrl) {
      const challenge = findSessionChallengeOfType(
        senderId,
        CHALLENGE_TYPE_LISTENING,
        (mediaUrl === it.ttsMediaUrl) || (mediaUrl === it.slowTtsMediaUrl)
      );

      if (isObject(challenge)) {
        sessionCurrentListeningChallenges[senderId] = challenge;
      }
    }
  }
}

/**
 * @param {string} event The event type.
 * @param {*} data The event payload.
 * @param {object} sender The sender of the event notification.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
async function handleUiEvent(event, data, sender) {
  const senderId = getSenderId(sender);

  if (EVENT_TYPE_SESSION_LOADED === event) {
    await handleSessionLoadedEvent(senderId, data);
  } else if (EVENT_TYPE_SOUND_PLAYED === event) {
    handleSoundPlayedEvent(senderId, data);
  }
}

database.open().then(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (MESSAGE_TYPE_ACTION_REQUEST === message.type) {
      runPromiseForEffects(handleActionRequest(message.action, message.value, sender, sendResponse));
    } else if (MESSAGE_TYPE_UI_EVENT_NOTIFICATION === message.type) {
      runPromiseForEffects(handleUiEvent(message.event, message.value, sender));
    }

    return true;
  });
});
