import { _, it } from 'one-liner.macro';
import { onActionRequest, onUiEvent } from 'duo-toolbox/extension/ipc';

import {
  isArray,
  isEmptyObject,
  isObject,
  isString,
  maxOf,
  minBy,
  minOf,
  sumOf,
} from 'duo-toolbox/utils/functions';

import { RESULT_CORRECT } from 'duo-toolbox/duo/challenges';
import { normalizeString } from './strings';

import {
  CHALLENGE_TYPE_LISTENING,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_TRANSLATION,
} from './constants';

import {
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
} from './ipc';

import * as Challenge from './challenges';
import * as Solution from './solutions';

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
 * @type {import('./challenges').Challenge[]}
 */
const sessionChallenges = [];

/**
 * For each practice session running in a tab, the last listening challenge that was detected.
 * @type {{[key: string]: Challenge|null}}
 */
const sessionLastListeningChallenges = {};

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
 * @param {string} sessionId A session ID.
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @param {boolean} [replace] Whether to replace the current challenges of the session.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const registerUiChallenges = async (sessionId, uiChallenges, fromLanguage, toLanguage, replace = true) => {
  const parsedChallenges = Challenge.parseUiChallenges(uiChallenges, fromLanguage, toLanguage);

  if (replace) {
    sessionChallenges[sessionId] = parsedChallenges;
  } else {
    sessionChallenges[sessionId] = (sessionChallenges[sessionId] || []).concat(parsedChallenges)
  }
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
      Challenge.addSimilarityScores(challenge, userReference);
      sendResult({ challenge, userReference });
    }
  }
};

/**
 * Parses and registers challenge data when a practice session is loaded.
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
      String(metaData.language || metaData.learning_language || data.learningLanguage || '').trim(),
      // If no metadata is available, assume that the new challenges belong to the current session.
      // This is the case for placement tests, for example, for which challenges are loaded one by one.
      !isEmptyObject(metaData)
    );
  }
};

/**
 * Registers the current listening challenge when a corresponding TTS media is played.
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
  }
});

onUiEvent(async (event, data, sender) => {
  switch (event) {
    case UI_EVENT_TYPE_SESSION_LOADED:
      await handleSessionLoadedEvent(getSenderId(sender), data);
      break;
    case UI_EVENT_TYPE_SOUND_PLAYED:
      handleSoundPlayedEvent(getSenderId(sender), data);
      break;
  }
});
