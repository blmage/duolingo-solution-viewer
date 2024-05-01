import { _, it, lift } from 'one-liner.macro';
import Dexie from 'dexie';
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

const database = new Dexie('dsv');

database
  .version(1)
  .stores({ sessions: 'sessionId,lastUpdatedAt' });

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
 * The global maximum number of parsed solution lists to keep in memory.
 * @type {number}
 */
const PARSED_COMPLEX_SOLUTION_LIST_CACHE_SIZE = 4;

/**
 * A global cache for parsed solution lists.
 * This value is kept in memory, because session storage is too limited
 * (and the worst-case scenario of having to parse solution lists again should not be a showstopper).
 * @type {Array}
 */
const parsedComplexSolutionListCache = [];

/**
 * @param {string} sessionId A session ID.
 * @param {Function} callback A callback to update the session data.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const updateSession = async (sessionId, callback) => {
  await database.transaction('rw', [ database.sessions ], async () => {
    const session = await database.sessions.get(sessionId);

    const applyUpdate = async () => {
      if (session) {
        await database.sessions.update(sessionId, {
          ...callback(session),
          lastUpdatedAt: Date.now(),
        });
      } else {
        await database.sessions.add({
          ...callback(),
          sessionId,
          lastUpdatedAt: Date.now(),
        });
      }
    };

    try {
      await applyUpdate();
    } catch (error) {
      if (
        (error.name === 'QuotaExceededError')
        || (error.inner && (error.inner.name === 'QuotaExceededError'))
      ) {
        await cleanSessions([ sessionId ]);
        await applyUpdate();
      } else {
        throw error;
      }
    }
  });
};

/**
 * Remove all practice sessions that have not been updated since a given timestamp.
 * @param {number[]} excludedIds The IDs of the sessions that should not be removed.
 * @param {number} lastUpdatedBefore The timestamp before which the sessions should be removed.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const cleanSessions = async (excludedIds = [], lastUpdatedBefore = Number.MAX_SAFE_INTEGER) => {
  await database
    .sessions
    .where('lastUpdatedAt')
    .below(lastUpdatedBefore)
    .and(!excludedIds.includes(_.sessionId))
    .delete();
};

/**
 * @param {string} sessionId A session ID.
 * @returns {Promise<Challenge[]>} A promise for the challenges of the given session.
 */
const getSessionChallenges = async sessionId => {
  const session = await database.sessions.get(sessionId);

  return isArray(session?.challenges) ? session.challenges : [];
};

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The first challenge of the given type and session to match the given predicate.
 */
const findSessionChallengeOfType = async (sessionId, challengeType, predicate) => {
  const challenges = await getSessionChallenges(sessionId);

  return !isArray(challenges)
    ? null
    : challenges.find(challenge => Challenge.isOfType(challenge, challengeType) && predicate(challenge))
};

/**
 * @param {string} sessionId A session ID.
 * @param {number} challengeType A challenge type.
 * @param {Function} predicate A predicate on challenges.
 * @returns {import('./challenges').Challenge|null}
 * The challenges of the given type and session that match the given predicate.
 */
const findSessionChallengesOfType = async (sessionId, challengeType, predicate) => {
  const challenges = await getSessionChallenges(sessionId);

  return !isArray(challenges)
    ? []
    : challenges.filter(challenge => Challenge.isOfType(challenge, challengeType) && predicate(challenge))
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

  await updateSession(
    sessionId,
    ({ challenges = [], ...data } = {}) => ({
      ...data,
      challenges: dedupeBy(
        challenges
          .concat(parsedChallenges)
          .splice(-MAX_REMEMBERED_SESSION_CHALLENGES),
        () => 1, // LRU behavior.
        lift(Challenge.getUniqueKey(_))
      ),
    })
  );
};

/**
 * @param {string} sessionId A session ID.
 * @returns {Promise<Challenge|null>} A promise for the last listening challenge of the given session, if any.
 */
const getSessionLastListeningChallenge = async sessionId => {
  const session = await database.sessions.get(sessionId);

  return session?.lastListeningChallenge || null;
};

/**
 * Registers the last listening challenge of an ongoing practice session.
 * @param {string} sessionId A session ID.
 * @param {Challenge} challenge A challenge.
 * @returns {Promise<void>} A promise for the result of the action.
 */
const setSessionLastListeningChallenge = async (sessionId, challenge) => {
  await updateSession(
    sessionId,
    (session = {}) => ({
      ...session,
      lastListeningChallenge: challenge
    })
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
  if (isObject(data) && isString(data.statement)) {
    const statement = normalizeString(data.statement);
    const userAnswer = !isString(data.userAnswer) ? '' : normalizeString(data.userAnswer);

    let challenge = await findSessionChallengeOfType(
      senderId,
      CHALLENGE_TYPE_TRANSLATION,
      statement === it.statement
    );

    if (!challenge) {
      challenge = await findSessionChallengeOfType(
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
      predicate = solutionTranslation === it.solutionTranslation;
    }

    challenges = await findSessionChallengesOfType(senderId, CHALLENGE_TYPE_LISTENING, predicate);

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
      const lastListeningChallenge = await getSessionLastListeningChallenge(senderId);

      challenge = (
        lastListeningChallenge
        && challenges.find(Challenge.isSameListeningChallenge(_, lastListeningChallenge))
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
      if (locale !== 'ja') {
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

    const challenge = await findSessionChallengeOfType(
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
const handleSoundPlayedEvent = async (senderId, data) => {
  if (isString(data)) {
    const mediaUrl = data.trim();

    if ('' !== mediaUrl) {
      const challenge = await findSessionChallengeOfType(
        senderId,
        CHALLENGE_TYPE_LISTENING,
        (mediaUrl === it.ttsMediaUrl) || (mediaUrl === it.slowTtsMediaUrl)
      );

      if (isObject(challenge)) {
        await setSessionLastListeningChallenge(senderId, challenge);
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
      await handleSoundPlayedEvent(getSenderId(sender), data);
      break;
  }
});

// Remove session challenges older than one day.
cleanSessions([], Date.now() - 60 * 60 * 24 * 1000);
