import { get, isArray, isString, maxBy, minBy, set } from 'lodash';
import { _, it } from 'param.macro';
import wrapFetchWithRetry from 'fetch-retry';
import sleep from 'sleep-promise';
import Dexie from 'dexie';

import {
  isEmptyObject,
  isObject,
  normalizeString,
  runPromiseForEffects,
} from './functions';

import * as solution from './solutions';

import {
  ACTION_RESULT_FAILURE,
  ACTION_RESULT_SUCCESS,
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER,
  ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE,
  ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES,
  EVENT_TYPE_SESSION_LOADED,
  EVENT_TYPE_SOUND_PLAYED,
  EXTENSION_CODE,
  LISTENING_CHALLENGE_TYPES,
  MESSAGE_TYPE_ACTION_REQUEST,
  MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
  NAMING_CHALLENGE_TYPES,
  RESULT_CORRECT,
  TRANSLATION_CHALLENGE_TYPES,
  WORD_BANK_CHALLENGE_TYPES,
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

const FIELD_CHALLENGE = 'challenge';
const FIELD_COMMENT_ID = 'comment_id';
const FIELD_DISCUSSION_ID = 'discussion_id';
const FIELD_INVERTED_SIZE = 'inverted_size';
const FIELD_LAST_ACCESS_AT = 'last_access_at';
const FIELD_USER_REFERENCE = 'user_reference';

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
 * A wrapper around fetch which retries twice when encountering an error.
 *
 * @function
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

// Clean the local storage when upgrading from version 2.0.1.

chrome.storage.local.get(null, values => {
  if (Object.keys(values || {}).some(it.indexOf('discussion_comment_id') >= 0)) {
    chrome.storage.local.clear();
  }
});

/**
 * A practice challenge.
 *
 * @typedef {object} Challenge
 * @property {string} statement The sentence to translate/recognize.
 * @property {import('./solutions.js').Solution[]} solutions The accepted translations.
 * @property {string} fromLanguage The language the user speaks.
 * @property {string} toLanguage The language the user learns.
 * @property {string} discussionId The ID of the forum discussion about the challenge.
 * @property {?number} commentId The ID of the forum comment about the challenge.
 *
 * The following properties are only available for listening challenges:
 * @property {?string} solutionTranslation The translation of the reference solution.
 * @property {?string} ttsMediaUrl The URL of the text-to-speech media.
 * @property {?string} slowTtsMediaUrl The URL of the slow text-to-speech media.
 */

/**
 * The translation challenges for each practice session running in a tab, arranged by statements.
 *
 * @type {object<string, object<string, Challenge>>}
 */
const sessionTranslationChallenges = {};

/**
 * The naming challenges for each practice session running in a tab.
 *
 * @type {object<string, Challenge[]>}
 */
const sessionNamingChallenges = {};

/**
 * The listening challenges for each practice session running in a tab, arranged by solution translations.
 *
 * @type {object<string, object<string, Challenge[]>>}
 */
const sessionListeningChallenges = {};

/**
 * The current listening challenge for each practice session running in a tab.
 *
 * @type {object<string, Challenge|null>}
 */
const sessionCurrentListeningChallenges = {};

/**
 * @param {Challenge} challengeA A listening challenge.
 * @param {Challenge} challengeB Another listening challenge.
 * @returns {boolean} Whether the two given challenges are the same.
 */
function isSameListeningChallenge(challengeA, challengeB) {
  return !!challengeA.ttsMediaUrl && (challengeA.ttsMediaUrl === challengeB.ttsMediaUrl)
    || !!challengeA.slowTtsMediaUrl && (challengeA.slowTtsMediaUrl === challengeB.slowTtsMediaUrl);
}

/**
 * @param {object} challenge A raw challenge.
 * @returns {import('./solutions.js').Solution[]} The corresponding list of solutions.
 */
function getChallengeSolutions(challenge) {
  const grader = isObject(challenge.grader) ? challenge.grader : {};
  const metaData = isObject(challenge.metadata) ? challenge.metadata : {};

  const locale = String(
    challenge.targetLanguage
    || grader.language
    || metaData.target_language
    || metaData.language
    || ''
  ).trim();

  if (NAMING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0) {
    if (isArray(challenge.correctSolutions)) {
      return solution.fromSentences(challenge.correctSolutions, locale);
    }
  }

  if (
    isObject(grader)
    && isArray(grader.vertices)
    && (grader.vertices.length > 0)
  ) {
    return solution.fromVertices(grader.vertices, locale, !!grader.whitespaceDelimited);
  }

  if (LISTENING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0) {
    if (isString(challenge.prompt) && ('' !== challenge.prompt)) {
      return solution.fromSentences([ challenge.prompt ], locale);
    }
  }

  if (WORD_BANK_CHALLENGE_TYPES.indexOf(challenge.type) >= 0) {
    if (isArray(challenge.correctTokens)) {
      return solution.fromWordBankTokens(challenge.correctTokens, locale);
    }
  }

  return [];
}

/**
 * Matches a user answer against each solution of a challenge, and updates their similarity scores.
 *
 * @param {Challenge} challenge A challenge.
 * @param {string} userAnswer A user answer to the challenge.
 */
function addSimilarityScoresToChallenge(challenge, userAnswer) {
  if ('' === userAnswer) {
    challenge.solutions.forEach(set(_, 'score', 0));
  } else {
    challenge.solutions.forEach(item => set(
      item,
      'score',
      solution.getMatchingScoreWithAnswer(item, userAnswer)
    ));
  }
}

/**
 * Registers the different challenges for a freshly loaded practice session.
 *
 * @param {string} senderId The ID of the tab where the session is running.
 * @param {Array} newChallenges A set of raw challenge data.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 */
async function registerNewChallenges(senderId, newChallenges, fromLanguage, toLanguage) {
  const newTranslationChallenges = {};
  const newNamingChallenges = [];
  const newListeningChallenges = {};
  const discussionChallenges = {};

  newChallenges.forEach(challenge => {
    const solutions = getChallengeSolutions(challenge);

    if (solutions.length > 0) {
      const statement = normalizeString(String(challenge.prompt || '')).trim();
      const discussionId = String(challenge.sentenceDiscussionId || '').trim();

      if (
        ('' !== statement)
        && (TRANSLATION_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
      ) {
        newTranslationChallenges[statement] = {
          statement,
          solutions,
          fromLanguage,
          toLanguage,
          discussionId
        };

        if (NAMING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0) {
          newNamingChallenges.push(newTranslationChallenges[statement]);
        }

        if ('' !== discussionId) {
          discussionChallenges[discussionId] = newTranslationChallenges[statement];
        }
      } else if (
        (LISTENING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
        && ('' !== String(challenge.solutionTranslation || '').trim())
      ) {
        const solutionTranslation = normalizeString(String(challenge.solutionTranslation)).trim();
        const ttsMediaUrl = String(challenge.tts || '').trim();
        const slowTtsMediaUrl = String(challenge.slowTts || '').trim();

        if (!newListeningChallenges[solutionTranslation]) {
          newListeningChallenges[solutionTranslation] = [];
        }

        newListeningChallenges[solutionTranslation].push({
          statement,
          solutions,
          fromLanguage,
          toLanguage,
          discussionId,
          solutionTranslation,
          ttsMediaUrl,
          slowTtsMediaUrl,
        });
      }
    }
  });

  sessionTranslationChallenges[senderId] = newTranslationChallenges;
  sessionNamingChallenges[senderId] = newNamingChallenges;
  sessionListeningChallenges[senderId] = newListeningChallenges;
  sessionCurrentListeningChallenges[senderId] = null;

  await registerCommentChallenges(Object.values(sessionTranslationChallenges[senderId]));
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
 * @returns {Promise<number>} A promise for the ID of the comment corresponding to the given forum discussion.
 */
async function getDiscussionCommentId(discussionId, fromLanguage, toLanguage) {
  const result = await database[TABLE_DISCUSSION_COMMENTS].get(discussionId);

  if (!isObject(result)) {
    const response = await fetchWithRetry(
      getDiscussionCommentDataUrl(
        discussionId,
        fromLanguage,
        toLanguage
      )
    );

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

  return result[FIELD_COMMENT_ID];
}

/**
 * @param {Challenge} challenge A challenge.
 * @returns {Promise<number>} A promise for the ID of the forum comment about the given challenge.
 */
async function getChallengeCommentId(challenge) {
  if (challenge.commentId > 0) {
    return challenge.commentId;
  }

  if (!challenge.discussionId) {
    throw new Error(`The challenge is not associated to a discussion.`);
  }

  challenge.commentId = await getDiscussionCommentId(
    challenge.discussionId,
    challenge.fromLanguage,
    challenge.toLanguage
  );

  return challenge.commentId;
}

/**
 * @param {Challenge} challenge The challenge referred to by the given forum discussion.
 * @returns {Promise<void>} A promise for the result of the update.
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
 * Registers the relations between a set of challenges and the corresponding forum comments.
 *
 * @param {Challenge[]} challenges A set of challenges.
 * @returns {Promise<void>} A promise for the result of the update.
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
 * @param {Challenge} challenge A challenge.
 * @param {string} reference A user reference.
 * @returns {Promise<void>} A promise for the result of the update.
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
 * @param {number} commentId The ID of a forum comment.
 * @returns {Promise<object>}
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
 * @param {object} sender The sender of a message.
 * @returns {string} A unique ID for the given sender.
 */
function getSenderId(sender) {
  const senderTabId = String(sender.tab && sender.tab.id || 'global');
  const senderFrameId = String(sender.frameId || 'main');
  return `${senderTabId}-${senderFrameId}`;
}

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current challenge back to the sender (if any).
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCurrentTranslationChallengeRequest(senderId, data, sendResult) {
  if (
    isObject(data)
    && isString(data.statement)
    && isObject(sessionTranslationChallenges[senderId])
  ) {
    const statement = normalizeString(data.statement).trim();
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer).trim();
    let challenge = sessionTranslationChallenges[senderId][statement];

    if (!challenge && isArray(sessionNamingChallenges[senderId])) {
      challenge = sessionNamingChallenges[senderId].find(statement.indexOf(_.statement) >= 0);
    }

    if (!isObject(challenge)) {
      return;
    }

    addSimilarityScoresToChallenge(challenge, userAnswer);
    sendResult(challenge);

    if ('' !== userAnswer) {
      await registerChallengeUserReference(challenge, userAnswer);
    }
  }
}

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current challenge back to the sender (if any).
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCurrentListeningChallengeRequest(senderId, data, sendResult) {
  if (
    isObject(data)
    && isString(data.solutionTranslation)
    && isObject(sessionListeningChallenges[senderId])
  ) {
    const solutionTranslation = normalizeString(data.solutionTranslation).trim();
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer).trim();
    let challenges = sessionListeningChallenges[senderId][solutionTranslation];

    if (!isArray(challenges) || (0 === challenges.length)) {
      return;
    }

    let challenge = (1 === challenges.length)
      ? challenges[0]
      : challenges.find(isSameListeningChallenge(_, sessionCurrentListeningChallenges[senderId]));

    if (!isObject(challenge)) {
      return;
    }

    const result = { challenge };
    addSimilarityScoresToChallenge(challenge, userAnswer);

    if (('' !== userAnswer) && (RESULT_CORRECT === data.result)) {
      const bestScore = maxBy(challenge.solutions, 'score').score;

      result.correctionDiff = minBy(
        challenge.solutions
          .filter(bestScore === it.score)
          .flatMap(solution.getBestMatchingReferencesForAnswer(_, userAnswer))
          .map(solution.diffReferenceWithAnswer(_, userAnswer))
          .filter(isArray),
        it.length
      );
    }

    sendResult(result);
  }
}

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the updated challenge back to the sender.
 */
function handleChallengeAnswerMatchingRequest(data, sendResult) {
  if (
    isObject(data)
    && isObject(data.challenge)
    && isString(data.userAnswer)
    && ('' !== data.userAnswer)
  ) {
    addSimilarityScoresToChallenge(data.challenge, data.userAnswer);
    sendResult({ challenge: data.challenge });
  }
}

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the challenge back to the sender (if any).
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCommentChallengeRequest(data, sendResult) {
  if (data > 0) {
    const result = await getCommentChallenge(data);

    if (isString(result.userReference) && ('' !== result.userReference)) {
      addSimilarityScoresToChallenge(result.challenge, result.userReference);
    }

    sendResult(result);
  }
}

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to notify the sender about the success of the update.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleDiscussionChallengesUpdateRequest(data, sendResult) {
  if (isObject(data) && !isEmptyObject(data)) {
    // Don't make the content script/UI script wait for a result it doesn't care about.
    sendResult();
    runPromiseForEffects(registerCommentChallenges(data));
  }
}

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send back the updated challenge and reference to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
async function handleCommentUserReferenceUpdateRequest(data, sendResult) {
  if (
    isObject(data)
    && (data.commentId > 0)
    && isString(data.userReference)
    && ('' !== data.userReference)
  ) {
    const result = await getCommentChallenge(data.commentId);
    await registerChallengeUserReference(result.challenge, data.userReference);
    addSimilarityScoresToChallenge(result.challenge, data.userReference);
    result.userReference = data.userReference;
    sendResult(result);
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
  try {
    let isResultSent = false;

    const sendResult = result => {
      isResultSent = true;
      sendResponse({ type: ACTION_RESULT_SUCCESS, value: result });
    };

    switch (action) {
      case ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE:
        await handleCurrentTranslationChallengeRequest(getSenderId(sender), data, sendResult);
        break;
      case ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE:
        await handleCurrentListeningChallengeRequest(getSenderId(sender), data, sendResult);
        break;
      case ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER:
        await handleChallengeAnswerMatchingRequest(data, sendResult);
        break;
      case ACTION_TYPE_GET_COMMENT_CHALLENGE:
        await handleCommentChallengeRequest(data, sendResult);
        break;
      case ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES:
        await handleDiscussionChallengesUpdateRequest(data, sendResult);
        break;
      case ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE:
        await handleCommentUserReferenceUpdateRequest(data, sendResult)
        break;
    }

    if (!isResultSent) {
      throw new Error(`Could not handle action: "${data.action}".`);
    }
  } catch (error) {
    sendResponse({ type: ACTION_RESULT_FAILURE });
  }
}

/**
 * Registers the corresponding challenges when a practice session is loaded.
 *
 * @param {string} senderId The sender of the event notification.
 * @param {object} data The event payload.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
async function handleSessionLoadedEvent(senderId, data) {
  if (isObject(data)) {
    const baseChallenges = isArray(data.challenges) ? data.challenges : [];
    const adaptiveChallenges = isArray(data.adaptiveChallenges) ? data.adaptiveChallenges : [];
    const metaData = isObject(data.metadata) ? data.metadata : {};

    await registerNewChallenges(
      senderId,
      baseChallenges.concat(adaptiveChallenges),
      String(metaData.ui_language || metaData.from_language || data.fromLanguage || '').trim(),
      String(metaData.language || data.learningLanguage || '').trim()
    );
  }
}

/**
 * Registers the current listening challenge when a TTS media is played.
 *
 * @param {string} senderId The sender of the event notification.
 * @param {object} data The event payload.
 */
function handleSoundPlayedEvent(senderId, data) {
  if (isString(data)) {
    const mediaUrl = data.trim();

    if (isObject(sessionListeningChallenges[senderId])) {
      const challenge = Object.values(sessionListeningChallenges[senderId])
        .flat()
        .find((mediaUrl === it.ttsMediaUrl) || (mediaUrl === it.slowTtsMediaUrl));

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
