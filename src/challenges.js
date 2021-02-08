import {
  UI_NAMING_CHALLENGE_TYPES,
  UI_LISTENING_CHALLENGE_TYPES,
  UI_WORD_BANK_CHALLENGE_TYPES,
  UI_TRANSLATION_CHALLENGE_TYPES,
  CHALLENGE_TYPE_TRANSLATION,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_LISTENING,
  EXTENSION_PREFIX
} from './constants';

import { isArray, isObject, isString, normalizeString } from './functions';
import * as Solution from './solutions';

/**
 * A practice challenge.
 *
 * @typedef {object} Challenge
 * @property {number} type The type(s) of the challenge.
 * @property {string} statement The sentence to translate / recognize.
 * @property {import('./solutions.js').Solution[]} solutions The accepted translations.
 * @property {string} fromLanguage The language the user speaks.
 * @property {string} toLanguage The language the user learns.
 * @property {string} discussionId The ID of the forum discussion about the challenge.
 * @property {?number} commentId The ID of the first forum comment about the challenge.
 * @property {?MatchingData} matchingData A base set of data usable for filtering / matching the solutions.
 *
 * The following properties are only available for listening challenges:
 * @property {?string} solutionTranslation The translation of the reference solution.
 * @property {?string} ttsMediaUrl The URL of the text-to-speech media.
 * @property {?string} slowTtsMediaUrl The URL of the slow text-to-speech media.
 */

/**
 * @typedef {object} MatchingOptions
 * @property {boolean} ignoreDiacritics Whether differences in diacritics should be ignored.
 * @property {boolean} ignoreWordOrder Whether differences in word order should be ignored.
 */

/**
 * A set of data about a challenge, usable for filtering or matching the corresponding solutions.
 *
 * @typedef {object} MatchingData
 * @property {MatchingOptions} options A set of matching options.
 * @property {string} locale The locale of the solutions.
 * @property {string[]} words A list of all the words found in the solutions, adapted for matching using the options.
 */

/**
 * @type {Function}
 * @param {Challenge} challenge A challenge.
 * @param {number} type A challenge type.
 * @returns {boolean} Whether the given challenge belongs to the given type.
 */
export const isOfType = (challenge, type) => (challenge.type & type) >= 0;

/**
 * @type {Function}
 * @param {Challenge} challenge A challenge.
 * @returns {string} A unique key for the challenge.
 */
export const getUniqueKey = challenge => (
  challenge.discussionId
  || `${EXTENSION_PREFIX}-${challenge.type}-${challenge.statement}`
)

/**
 * @param {Challenge} challengeA A listening challenge.
 * @param {Challenge} challengeB Another listening challenge.
 * @returns {boolean} Whether the two given challenges are the same.
 */
export function isSameListeningChallenge(challengeA, challengeB) {
  return !!challengeA.ttsMediaUrl && (challengeA.ttsMediaUrl === challengeB.ttsMediaUrl)
    || !!challengeA.slowTtsMediaUrl && (challengeA.slowTtsMediaUrl === challengeB.slowTtsMediaUrl);
}

/**
 * Adds matching data to a challenge and the corresponding solutions.
 *
 * @param {Challenge} challenge The challenge.
 */
export function addMatchingData(challenge) {
  if (!isObject(challenge.matchingData)) {
    const matchingOptions = {
      ignoreDiacritics: false,
      ignoreWordOrder: true,
    };

    const words = new Set();

    challenge.solutions.forEach((solution, index) => {
      Solution.addMatchingData(solution, index, matchingOptions);

      for (const word of solution.matchingData.words) {
        words.add(word);
      }
    });

    challenge.matchingData = {
      matchingOptions,
      words: Array.from(words),
      locale: challenge.toLanguage,
    };
  }
}

/**
 * Matches a user answer against each solution of a challenge, and updates their similarity scores.
 *
 * If it has not been done yet, also adds matching data to the challenge and the corresponding solutions.
 *
 * @param {Challenge} challenge A challenge.
 * @param {string} userAnswer A user answer.
 */
export function addSimilarityScores(challenge, userAnswer) {
  addMatchingData(challenge);

  if ('' === userAnswer) {
    challenge.solutions.forEach(solution => {
      solution.score = 0;
    });
  } else {
    challenge.solutions.forEach(solution => {
      solution.score = Solution.getMatchingScoreWithAnswer(
        solution,
        userAnswer,
        challenge.matchingData.matchingOptions
      );
    });
  }
}

/**
 * @param {object} challenge Raw challenge data from the UI.
 * @returns {import('./solutions.js').Solution[]} The list of solutions to the challenge.
 */
function getUiChallengeSolutions(challenge) {
  const grader = isObject(challenge.grader) ? challenge.grader : {};
  const metaData = isObject(challenge.metadata) ? challenge.metadata : {};

  const locale = String(
    challenge.targetLanguage
    || grader.language
    || metaData.target_language
    || metaData.language
    || ''
  ).trim();

  if (
    isArray(challenge.correctSolutions)
    && (UI_NAMING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
  ) {
    return Solution.fromSentences(challenge.correctSolutions, locale);
  }

  if (
    isObject(grader)
    && isArray(grader.vertices)
    && (grader.vertices.length > 0)
  ) {
    return Solution.fromVertices(grader.vertices, locale, !!grader.whitespaceDelimited);
  }

  if (
    isString(challenge.prompt)
    && ('' !== challenge.prompt)
    && (UI_LISTENING_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
  ) {
    return Solution.fromSentences([ challenge.prompt ], locale);
  }

  if (
    isArray(challenge.correctTokens)
    && (UI_WORD_BANK_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
  ) {
    return Solution.fromWordBankTokens(challenge.correctTokens, locale);
  }

  return [];
}

/**
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Challenge[]} The challenges that are relevant to the extension, parsed and ready for use.
 */
export function parseUiChallenges(uiChallenges, fromLanguage, toLanguage) {
  return uiChallenges.map(uiChallenge => {
    const solutions = getUiChallengeSolutions(uiChallenge);

    if (solutions.length > 0) {
      const statement = normalizeString(String(uiChallenge.prompt || ''));
      const discussionId = String(uiChallenge.sentenceDiscussionId || '').trim();

      if (
        ('' !== statement)
        && (UI_TRANSLATION_CHALLENGE_TYPES.indexOf(uiChallenge.type) >= 0)
      ) {
        const type = (UI_NAMING_CHALLENGE_TYPES.indexOf(uiChallenge.type) >= 0)
          ? CHALLENGE_TYPE_NAMING
          : CHALLENGE_TYPE_TRANSLATION;

        return {
          type,
          statement,
          solutions,
          fromLanguage,
          toLanguage,
          discussionId,
        };
      } else if (
        (UI_LISTENING_CHALLENGE_TYPES.indexOf(uiChallenge.type) >= 0)
        && ('' !== String(uiChallenge.solutionTranslation || '').trim())
      ) {
        const solutionTranslation = normalizeString(String(uiChallenge.solutionTranslation));
        const ttsMediaUrl = String(uiChallenge.tts || '').trim();
        const slowTtsMediaUrl = String(uiChallenge.slowTts || '').trim();

        return {
          type: CHALLENGE_TYPE_LISTENING,
          statement,
          solutions,
          fromLanguage,
          toLanguage,
          discussionId,
          solutionTranslation,
          ttsMediaUrl,
          slowTtsMediaUrl,
        };
      }
    }
  }).filter(isObject);
}
