import 'core-js/features/array/flat-map';
import 'core-js/features/string/match-all';
import { _, it } from 'one-liner.macro';
import Dexie from 'dexie';
import { onActionRequest, onUiEvent } from 'duo-toolbox/extension/ipc';
import { isArray, isNumber, isObject, isString, maxOf, minBy, minOf, sumOf } from 'duo-toolbox/utils/functions';
import { RESULT_CORRECT } from 'duo-toolbox/duo/challenges';
import { normalizeString } from './strings';

import {
  CHALLENGE_TYPE_LISTENING,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_TRANSLATION,
  EXTENSION_CODE,
} from './constants';

import {
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE,
  UI_EVENT_TYPE_DISCUSSION_LOADED,
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
} from './ipc';

import * as Challenge from './challenges';
import * as Solution from './solutions';

/**
 * @param {string[]} fields A list of field names.
 * @returns {string} The definition of the compound index based on the given fields.
 */
const getCompoundIndex = fields => `[${fields.join('+')}]`;

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
    await database.table(TABLE_DISCUSSION_COMMENTS).clear();

    do {
      const originalRows = await database.table(TABLE_COMMENT_CHALLENGES)
        .orderBy(':id')
        .limit(200)
        .toArray();

      if (0 === originalRows.length) {
        break;
      }

      const obsoleteIds = [];
      const commentRows = [];
      const challengeRows = [];

      for (const challengeRow of originalRows) {
        const discussionId = challengeRow[FIELD_CHALLENGE].discussionId;
        const locale = Challenge.getStatementLocale(challengeRow[FIELD_CHALLENGE]);

        const commentRow = {
          [FIELD_COMMENT_ID]: challengeRow[FIELD_COMMENT_ID],
          [FIELD_DISCUSSION_ID]: discussionId,
          [FIELD_LOCALE]: locale,
        };

        challengeRow[FIELD_DISCUSSION_ID] = discussionId;
        challengeRow[FIELD_LOCALE] = locale;

        obsoleteIds.push(challengeRow[FIELD_COMMENT_ID])
        delete challengeRow[FIELD_COMMENT_ID];

        commentRows.push(commentRow);
        challengeRows.push(challengeRow);
      }

      await database.table(TABLE_COMMENT_CHALLENGES).bulkDelete(obsoleteIds);
      await database.table(TABLE_COMMENT_DISCUSSIONS).bulkPut(commentRows);
      await database.table(TABLE_DISCUSSION_CHALLENGES).bulkPut(challengeRows);

      // eslint-disable-next-line no-constant-condition
    } while (true);
  });

// Fix detection of challenges for discussions that exist in multiple languages.
// Clean up obsolete tables and unwanted challenges from the database.
database.version(3).upgrade(async () => {
  await database.table(TABLE_COMMENT_DISCUSSIONS).clear();

  let offset = 0;

  do {
    const challengeRows = await database.table(TABLE_DISCUSSION_CHALLENGES)
      .orderBy(':id')
      .offset(offset)
      .limit(200)
      .toArray();

    if (0 === challengeRows.length) {
      break;
    }

    const obsoleteIds = [];
    const updatedRows = [];

    for (const challengeRow of challengeRows) {
      obsoleteIds.push([
        challengeRow[FIELD_DISCUSSION_ID],
        challengeRow[FIELD_LOCALE],
      ]);

      if (!Challenge.isOfType(challengeRow[FIELD_CHALLENGE], CHALLENGE_TYPE_LISTENING)) {
        challengeRow[FIELD_LOCALE] = Challenge.getSolutionsLocale(challengeRow[FIELD_CHALLENGE]);
        updatedRows.push(challengeRow);
        ++offset;
      }
    }

    await database.table(TABLE_DISCUSSION_CHALLENGES).bulkDelete(obsoleteIds);
    await database.table(TABLE_DISCUSSION_CHALLENGES).bulkPut(updatedRows);

    // eslint-disable-next-line no-constant-condition
  } while (true);
});

/**
 * @returns {number} The index of the current 30-minute slice of time.
 */
const getCurrentAccessAt = () => Math.floor((new Date()).getTime() / 1000 / 60 / 30);

/**
 * @param {string} table The table in which to insert/update the value.
 * @param {object} value The value to insert/update in the table.
 * @returns {Promise<void>}
 * A promise which will fail or succeed depending on the result of the action.
 * If a quota error occurs, old challenges will be purged before the action is retried once.
 */
const putWithRetry = async (table, value) => {
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
};

/**
 * @param {object} sender The sender of a message.
 * @returns {string} A unique ID for the given sender.
 */
const getSenderId = sender => {
  const senderTabId = String(sender.tab?.id || 'global');
  const senderFrameId = String(sender.frameId || 'main');
  return `${senderTabId}-${senderFrameId}`;
};

/**
 * For each practice session running in a tab, the corresponding list of challenges.
 *
 * @type {import('./challenges').Challenge[]}
 */
const sessionChallenges = [];

/**
 * For each practice session running in a tab, the last listening challenge that was detected.
 *
 * @type {object<string, Challenge|null>}
 */
const sessionLastListeningChallenges = {};

/**
 * Registers the relation between a forum comment and a forum discussion.
 *
 * @type {Function}
 * @param {number} commentId The ID of a forum comment.
 * @param {string} discussionId The ID of a forum discussion.
 * @param {string} locale The locale
 * @returns {Promise<void>} A promise for the result of the action.
 */
const registerCommentDiscussion = async (commentId, discussionId, locale) => {
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
const getCommentChallenge = async commentId => {
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
};

/**
 * Registers the relation between a challenge and the corresponding forum discussion.
 *
 * @param {import('./challenges').Challenge} challenge A challenge.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const registerDiscussionChallenge = async challenge => {
  if (!challenge.discussionId) {
    return Promise.resolve();
  }

  const challengeSize = JSON.stringify(challenge).length;

  if (challengeSize > MAX_CHALLENGE_SIZE) {
    throw new Error(
      `The discussion #${challenge.discussionId} has a challenge whose serialized size exceeds the limit.`
    );
  }

  await putWithRetry(TABLE_DISCUSSION_CHALLENGES, {
    [FIELD_DISCUSSION_ID]: challenge.discussionId,
    [FIELD_LOCALE]: Challenge.getSolutionsLocale(challenge),
    [FIELD_CHALLENGE]: challenge,
    [FIELD_INVERTED_SIZE]: MAX_CHALLENGE_SIZE - challengeSize,
    [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
  });
};

/**
 * Registers the relations between some challenges and the corresponding forum discussions.
 *
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
const registerChallengeUserReference = async (challenge, reference) => {
  if (!challenge.discussionId) {
    return;
  }

  await database[TABLE_DISCUSSION_CHALLENGES].update(
    [ challenge.discussionId, Challenge.getSolutionsLocale(challenge) ],
    {
      [FIELD_USER_REFERENCE]: reference,
      [FIELD_LAST_ACCESS_AT]: getCurrentAccessAt(),
    }
  );
};

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The first challenge of the given type and session to match the given predicate.
 */
const findSessionChallengeOfType = (sessionId, challengeType, predicate) => (
  !isArray(sessionChallenges[sessionId])
    ? null
    : sessionChallenges[sessionId].find(challenge => (
      Challenge.isOfType(challenge, challengeType) && predicate(challenge)
    ))
);

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The challenges of the given type and session that match the given predicate.
 */
const findSessionChallengesOfType = (sessionId, challengeType, predicate) => {
  return !isArray(sessionChallenges[sessionId])
    ? []
    : sessionChallenges[sessionId].filter(challenge => (
      Challenge.isOfType(challenge, challengeType) && predicate(challenge)
    ))
};

/**
 * Parses and registers the challenges of a new practice session that are relevant to the extension.
 *
 * @param {string} sessionId A session ID.
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const registerUiChallenges = async (sessionId, uiChallenges, fromLanguage, toLanguage) => {
  sessionChallenges[sessionId] = Challenge.parseUiChallenges(uiChallenges, fromLanguage, toLanguage);

  await registerDiscussionChallenges(
    sessionChallenges[sessionId].filter(Challenge.isOfType(_, CHALLENGE_TYPE_TRANSLATION))
  );
};

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current translation challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const handleCurrentTranslationChallengeRequest = async (senderId, data, sendResult) => {
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
        statement.includes(it.statement)
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
};

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the current listening challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const handleCurrentListeningChallengeRequest = async (senderId, data, sendResult) => {
  if (isObject(data)) {
    let challenges;
    let predicate = () => true;
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer);

    if (isString(data.solutionTranslation) && ('' !== data.solutionTranslation)) {
      const solutionTranslation = normalizeString(data.solutionTranslation);
      predicate = solutionTranslation === it.solutionTranslation;
    }

    challenges = findSessionChallengesOfType(senderId, CHALLENGE_TYPE_LISTENING, predicate);

    if (0 === challenges.length) {
      return;
    }

    let challenge = null;

    if (
      isString(data.solutionTranslation)
      && ('' !== data.solutionTranslation)
      && (1 === challenges.length)
    ) {
      challenge = challenges.pop();
    } else {
      challenge = (
        sessionLastListeningChallenges[senderId]
        && challenges.find(Challenge.isSameListeningChallenge(_, sessionLastListeningChallenges[senderId]))
      );
    }

    if (!isObject(challenge)) {
      return;
    }

    Challenge.addSimilarityScores(challenge, userAnswer);

    const result = { challenge };

    if (('' !== userAnswer) && (RESULT_CORRECT === data.result)) {
      let variations;
      const locale = Challenge.getSolutionsLocale(challenge);
      const matchingOptions = challenge.matchingData.matchingOptions;

      // The Japanese solution graph is not reliable enough
      // (we should apply token transliterations to all solutions before checking for differences).
      if (locale !== 'ja') {
        if (challenge.solutions.some('score' in it)) {
          const bestScore = maxOf(challenge.solutions, it.score);

          variations = challenge.solutions
            .filter(bestScore === it.score)
            .flatMap(Solution.getBestMatchingVariationsForAnswer(_, userAnswer, matchingOptions))
        } else {
          variations = challenge.solutions.flatMap(Solution.getAllVariations(_));
        }

        const correctionDiffs = variations.map(Solution.getVariationDiffWithAnswer(_, userAnswer, locale));

        // Do not display a correction if any variation is equivalent to the answer (regardless of the scores).
        if (correctionDiffs.every(isArray(_))) {
          // Use the correction with the least ..
          const bestScore = minOf(correctionDiffs, it.length);

          // .. and shortest differences.
          result.correctionDiff = minBy(
            correctionDiffs.filter(bestScore === it.length),
            sumOf(_, !it.ignorable && (it.added || it.removed) && it.value.length || 0)
          );
        }
      }
    }

    sendResult(result);
  }
};

/**
 * @param {string} senderId The ID of the sender of the request.
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the updated challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const handleCurrentChallengeUserReferenceUpdateRequest = async (senderId, data, sendResult) => {
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
};

/**
 * @param {number} commentId The ID of a forum comment.
 * @param {Function} sendResult A callback usable to send the corresponding challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the request.
 */
const handleCommentChallengeRequest = async (commentId, sendResult) => {
  if (isNumber(commentId) && (commentId > 0)) {
    const result = await getCommentChallenge(commentId);

    if (isString(result.userReference) && ('' !== result.userReference)) {
      Challenge.addSimilarityScores(result.challenge, result.userReference);
    } else {
      Challenge.addMatchingData(result.challenge);
    }

    sendResult(result);
  }
};

/**
 * @param {object} data The request payload.
 * @param {Function} sendResult A callback usable to send the updated challenge back to the sender.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const handleCommentChallengeUserReferenceUpdateRequest = async (data, sendResult) => {
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
};

/**
 * Parses and registers challenge data when a practice session is loaded.
 *
 * @param {string} senderId The ID of the sender of the event notification.
 * @param {object} data The event payload.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
const handleSessionLoadedEvent = async (senderId, data) => {
  if (isObject(data)) {
    const metaData = isObject(data.sessionMetaData) ? data.sessionMetaData : {};
    const challenges = isArray(data.challenges) ? data.challenges : [];

    await registerUiChallenges(
      senderId,
      challenges,
      String(metaData.ui_language || metaData.from_language || data.fromLanguage || '').trim(),
      String(metaData.language || metaData.learning_language || data.learningLanguage || '').trim()
    );
  }
};

/**
 * Registers the relation between forum comments and forum discussions upon loading the latter.
 *
 * @param {object} data The event payload.
 * @returns {Promise<void>} A promise for the result of the event handling.
 */
const handleDiscussionLoadedEvent = async (data) => {
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
};

/**
 * Registers the current listening challenge when a corresponding TTS media is played.
 *
 * @param {string} senderId The ID of the sender of the event notification.
 * @param {object} data The event payload.
 */
const handleSoundPlayedEvent = (senderId, data) => {
  if (isString(data)) {
    const mediaUrl = data.trim();

    if ('' !== mediaUrl) {
      const challenge = findSessionChallengeOfType(
        senderId,
        CHALLENGE_TYPE_LISTENING,
        (mediaUrl === it.ttsMediaUrl) || (mediaUrl === it.slowTtsMediaUrl)
      );

      if (isObject(challenge)) {
        sessionLastListeningChallenges[senderId] = challenge;
      }
    }
  }
};

database.open().then(() => {
  onActionRequest(async (action, data, sender, sendResult) => {
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
  });

  onUiEvent(async (event, data, sender) => {
    switch (event) {
      case UI_EVENT_TYPE_SESSION_LOADED:
        await handleSessionLoadedEvent(getSenderId(sender), data);
        break;
      case UI_EVENT_TYPE_DISCUSSION_LOADED:
        await handleDiscussionLoadedEvent(data);
        break;
      case UI_EVENT_TYPE_SOUND_PLAYED:
        handleSoundPlayedEvent(getSenderId(sender), data);
        break;
    }
  });
});
