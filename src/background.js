import 'core-js/features/array/flat-map';
import 'core-js/features/string/match-all';
import { _, it } from 'param.macro';
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
  EVENT_TYPE_DISCUSSION_LOADED,
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

const TABLE_COMMENT_CHALLENGES = 'comment_challenges';
const TABLE_COMMENT_DISCUSSIONS = 'comment_discussions';
const TABLE_DISCUSSION_CHALLENGES = 'discussion_challenges';
const TABLE_DISCUSSION_COMMENTS = 'discussion_comments';

const FIELD_CHALLENGE = 'challenge';
const FIELD_COMMENT_ID = 'comment_id';
const FIELD_DISCUSSION_ID = 'discussion_id';
const FIELD_INVERTED_SIZE = 'inverted_size';
const FIELD_LAST_ACCESS_AT = 'last_access_at';
const FIELD_LOCALE = 'locale';
const FIELD_USER_REFERENCE = 'user_reference';

const INDEX_DISCUSSION_LOCALE = getCompoundIndex([ FIELD_DISCUSSION_ID, FIELD_LOCALE ]);
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

// Associate challenges to forum discussions rather than comments.
database.version(2)
  .stores({
    [TABLE_COMMENT_DISCUSSIONS]: [
      FIELD_COMMENT_ID,
    ].join(','),
    [TABLE_DISCUSSION_CHALLENGES]: [
      INDEX_DISCUSSION_LOCALE,
      INDEX_CHALLENGE_PRIORITY,
    ].join(','),
  })
  .upgrade(async () => {
    await database.table(TABLE_COMMENT_CHALLENGES)
      .count(async count => {
        const sliceSize = 200;
        const sliceCount = Math.ceil(count / sliceSize);

        for (let slice = 0; slice < sliceCount; slice++) {
          const commentRows = [];
          const challengeRows = [];

          await database.table(TABLE_COMMENT_CHALLENGES)
            .offset(slice * sliceSize)
            .limit(sliceSize)
            .each(challengeRow => {
              const discussionId = challengeRow[FIELD_CHALLENGE].discussionId;
              const locale = Challenge.getStatementLocale(challengeRow[FIELD_CHALLENGE]);

              const commentRow = {
                [FIELD_COMMENT_ID]: challengeRow[FIELD_COMMENT_ID],
                [FIELD_DISCUSSION_ID]: discussionId,
                [FIELD_LOCALE]: locale,
              };

              challengeRow[FIELD_DISCUSSION_ID] = discussionId;
              challengeRow[FIELD_LOCALE] = locale;
              delete challengeRow[FIELD_COMMENT_ID];

              commentRows.push(commentRow);
              challengeRows.push(challengeRow);
            });

          await database.table(TABLE_COMMENT_DISCUSSIONS).bulkPut(commentRows);
          await database.table(TABLE_DISCUSSION_CHALLENGES).bulkPut(challengeRows);
        }
      });

    await database.table(TABLE_COMMENT_CHALLENGES).clear();
    await database.table(TABLE_DISCUSSION_COMMENTS).clear();
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

      const purgedIds = await database[TABLE_DISCUSSION_CHALLENGES]
        .orderBy(INDEX_CHALLENGE_PRIORITY)
        .until(checkPurgedSize, true)
        .toArray()
        .map([ it[FIELD_DISCUSSION_ID], it[FIELD_LOCALE] ]);

      await database[TABLE_DISCUSSION_CHALLENGES].bulkDelete(purgedIds);

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
 * Registers the relation between a forum comment and a forum discussion.
 *
 * @type {Function}
 * @param {number} commentId The ID of a forum comment.
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} locale The locale
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerCommentDiscussion(commentId, discussionId, locale) {
  await putWithRetry(TABLE_COMMENT_DISCUSSIONS, {
    [FIELD_COMMENT_ID]: commentId,
    [FIELD_DISCUSSION_ID]: discussionId,
    [FIELD_LOCALE]: locale,
  });
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @returns {Promise<Object>}
 * A promise for the challenge which is discussed by the given forum comment,
 * and the last user reference that it was associated to.
 */
async function getCommentChallenge(commentId) {
  let result = await database[TABLE_COMMENT_DISCUSSIONS].get(commentId);

  if (isObject(result)) {
    const discussionKey = [ result[FIELD_DISCUSSION_ID], result[FIELD_LOCALE] ];

    result = await database[TABLE_DISCUSSION_CHALLENGES]
      .where(INDEX_DISCUSSION_LOCALE)
      .equals(discussionKey)
      .first();

    if (isObject(result)) {
      try {
        await database[TABLE_DISCUSSION_CHALLENGES].update(
          discussionKey,
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
  }

  throw new Error(`There is no challenge for comment #${commentId}.`);
}

/**
 * Registers the relation between a challenge and the corresponding forum discussion.
 *
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerDiscussionChallenge(challenge) {
  const challengeSize = JSON.stringify(challenge).length;

  if (challengeSize > MAX_CHALLENGE_SIZE) {
    throw new Error(
      `The discussion #${challenge.discussionId} has a challenge whose serialized size exceeds the limit.`
    );
  }

  await putWithRetry(TABLE_DISCUSSION_CHALLENGES, {
    [FIELD_DISCUSSION_ID]: challenge.discussionId,
    [FIELD_LOCALE]: Challenge.getStatementLocale(challenge),
    [FIELD_CHALLENGE]: challenge,
    [FIELD_INVERTED_SIZE]: MAX_CHALLENGE_SIZE - challengeSize,
    [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
  });
}

/**
 * Registers the relations between some challenges and the corresponding forum discussions.
 *
 * @type {Function}
 * @param {import('./challenges').Challenge[]} challenges A set of challenges.
 * @returns {Promise<void>} A promise for the result of the actions.
 */
const registerDiscussionChallenges = async challenges => Promise.all(challenges.map(registerDiscussionChallenge(_)));

/**
 * Registers a new user reference for a challenge.
 *
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @param {string} reference A user reference.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function registerChallengeUserReference(challenge, reference) {
  if (!challenge.discussionId) {
    return;
  }

  await database[TABLE_DISCUSSION_CHALLENGES].update(
    [ challenge.discussionId, Challenge.getStatementLocale(challenge) ],
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

  await registerDiscussionChallenges(
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
      const matchingOptions = challenge.matchingData.matchingOptions;
      let variations;

      if (challenge.solutions.some('score' in it)) {
        const bestScore = maxOf(challenge.solutions, it.score);

        variations = challenge.solutions
          .filter(bestScore === it.score)
          .flatMap(Solution.getBestMatchingVariationsForAnswer(_, userAnswer, matchingOptions))
      } else {
        variations = challenge.solutions.flatMap(Solution.getAllVariations(_));
      }

      const correctionDiffs = variations.map(Solution.getVariationDiffWithAnswer(_, userAnswer, matchingOptions));

      // Do not display a correction if any variation is equivalent to the answer (regardless of the scores).
      if (correctionDiffs.every(isArray(_))) {
        result.correctionDiff = minBy(correctionDiffs, it.length);
      }
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
  if (isNumber(commentId) && (commentId > 0)) {
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
    && isNumber(data.commentId)
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
 * Registers the relation between forum comments and forum discussions upon loading the latter.
 *
 * @param {string} senderId The ID of the sender of the event notification.
 * @param {object} data The event payload.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
async function handleDiscussionLoadedEvent(senderId, data) {
  if (
    isObject(data)
    && isNumber(data.commentId)
    && (data.commentId > 0)
    && isString(data.discussionId)
    && ('' !== data.discussionId)
    && isString(data.locale)
    && ('' !== data.locale)
  ) {
    await registerCommentDiscussion(data.commentId, data.discussionId, data.locale);
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
  } else if (EVENT_TYPE_DISCUSSION_LOADED === event) {
    await handleDiscussionLoadedEvent(senderId, data);
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
