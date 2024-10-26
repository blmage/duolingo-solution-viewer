import { _, it, lift } from 'one-liner.macro';
import { onActionRequest, onUiEvent } from 'duo-toolbox/extension/ipc';
import { dedupeBy, isArray, isObject, isString, maxOf, minBy, minOf, sumOf } from 'duo-toolbox/utils/functions';
import { RESULT_CORRECT } from 'duo-toolbox/duo/challenges';
import { normalizeString } from '../common/strings';

import {
  CHALLENGE_TYPE_LISTENING,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_TRANSLATION,
  SOLUTION_LIST_TYPE_COMPACT,
} from '../common/constants';

import {
  ACTION_TYPE_GET_CHALLENGE_BY_KEY,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
} from '../common/ipc';

import * as Challenge from '../common/challenges';
import * as Solution from '../common/solutions';

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
 * For each practice session running in a tab, the maximum number of challenges to keep in memory.
 * @type {number}
 */
const MAX_REMEMBERED_SESSION_CHALLENGES = 200;

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
 * The global maximum number of parsed solution lists to keep in memory.
 * @type {number}
 */
const PARSED_COMPLEX_SOLUTION_LIST_CACHE_SIZE = 4;

/**
 * A global cache for parsed solution lists.
 * @type {Array}
 */
const parsedComplexSolutionListCache = [];

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
 * @returns {Promise<void>} A promise for the result of the action.
 */
const registerUiChallenges = async (sessionId, uiChallenges, fromLanguage, toLanguage) => {
  const parsedChallenges = Challenge.parseUiChallenges(uiChallenges, fromLanguage, toLanguage);

  sessionChallenges[sessionId] = dedupeBy(
    (sessionChallenges[sessionId] || [])
      .concat(parsedChallenges)
      .splice(-MAX_REMEMBERED_SESSION_CHALLENGES),
    () => 1, // LRU behavior.
    lift(Challenge.getUniqueKey(_))
  );
};

/**
 * @param {Challenge} challenge A challenge.
 * @param {string} type The preferred type of solutions to be returned.
 * @returns {import('./challenges.js').SolutionList}
 * A list of parsed solutions for the given challenge.
 * If the requested type is not available, the returned list may be of any type.
 */
const getChallengeParsedSolutionList = (challenge, type) => {
  // If the solution list of the challenge is already parsed, return it.
  // Otherwise, parse it if needed and cache it.
  if (challenge.solutions.parsed) {
    return challenge.solutions;
  }

  const key = Challenge.getUniqueKey(challenge);
  const cached = parsedComplexSolutionListCache.find((it.key === key) && (it.type === type));

  if (cached) {
    return cached.list;
  }

  const list = Challenge.getParsedSolutionList(challenge, type);
  list.otherTypes = Challenge.getAvailableSolutionListTypes(challenge).filter(it !== list.type);

  parsedComplexSolutionListCache.splice(
    0,
    Math.max(0, parsedComplexSolutionListCache.length + 1 - PARSED_COMPLEX_SOLUTION_LIST_CACHE_SIZE)
  );

  parsedComplexSolutionListCache.push({ key, type, list });

  return list;
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

    const solutions = getChallengeParsedSolutionList(
      challenge,
      data.listType || SOLUTION_LIST_TYPE_COMPACT
    );

    Challenge.addSimilarityScoresToSolutionList(solutions, userAnswer);

    sendResult({ ...challenge, solutions });
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

      predicate = challenge => (
        solutionTranslation.startsWith(challenge.solutionTranslation)
        || solutionTranslation.endsWith(challenge.solutionTranslation)
      );
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

    const solutions = getChallengeParsedSolutionList(
      challenge,
      data.listType || SOLUTION_LIST_TYPE_COMPACT
    );

    Challenge.addSimilarityScoresToSolutionList(solutions, userAnswer);

    const result = {
      challenge: { ...challenges, solutions },
    };

    if (('' !== userAnswer) && (RESULT_CORRECT === data.result)) {
      let variations;
      const locale = Challenge.getSolutionsLocale(challenge);
      const matchingOptions = solutions.matchingData.matchingOptions;

      // The Japanese solution graph is not reliable enough
      // (we should apply token transliterations to all solutions before checking for differences).
      if (false && (locale !== 'ja')) { // eslint-disable-line no-constant-condition
        if (solutions.list.some('score' in it)) {
          const bestScore = maxOf(solutions.list, it.score);

          variations = solutions.list
            .filter(bestScore === it.score)
            .flatMap(Solution.getBestMatchingVariationsForAnswer(_, userAnswer, matchingOptions))
        } else {
          variations = solutions.list.flatMap(Solution.getAllVariations(_));
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
  ) {
    const userReference = data.userReference.trim();

    const challenge = findSessionChallengeOfType(
      senderId,
      CHALLENGE_TYPE_TRANSLATION,
      Challenge.getUniqueKey(_) === data.key
    );

    if (isObject(challenge)) {
      const solutions = getChallengeParsedSolutionList(
        challenge,
        data.listType || SOLUTION_LIST_TYPE_COMPACT
      );

      Challenge.addSimilarityScoresToSolutionList(solutions, userReference);

      sendResult({
        challenge: {
          ...challenge,
          solutions,
        },
        userReference,
      });
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
      String(metaData.language || metaData.learning_language || data.learningLanguage || '').trim()
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
    case ACTION_TYPE_GET_CHALLENGE_BY_KEY:
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
