import { _, _1, _2, it } from 'one-liner.macro';
import { isArray, isObject, isString } from 'duo-toolbox/utils/functions';

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

import { normalizeString } from './strings';
import * as Solution from './solutions';

/**
 * A practice challenge.
 * @typedef {object} Challenge
 * @property {number} type The type(s) of the challenge.
 * @property {string} statement The sentence to translate / recognize.
 * @property {import('./solutions.js').Solution[]} solutions The accepted translations.
 * @property {string} fromLanguage The language the user speaks.
 * @property {string} toLanguage The language the user learns.
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
 * @typedef {object} MatchingData
 * @property {MatchingOptions} options A set of matching options.
 * @property {string} locale The locale of the solutions.
 * @property {?(string[])} words
 * A list of all the words found in the solutions, adapted for matching using the corresponding options.
 * The list may be absent if solutions in the given locale do not use tokens based on words.
 */

/**
 * @type {Function}
 * @param {Challenge} challenge A challenge.
 * @param {number} type A challenge type.
 * @returns {boolean} Whether the given challenge belongs to the given type.
 */
export const isOfType = (challenge, type) => (challenge.type & type) > 0;

/**
 * @type {Function}
 * @param {Challenge} challenge A challenge.
 * @returns {string} A unique key for the challenge.
 */
export const getUniqueKey = challenge => (
  challenge.discussionId
  || `${EXTENSION_PREFIX}-${challenge.type}-${challenge.statement}`
);

/**
 * @type {Function}
 * @param {Challenge} challengeA A listening challenge.
 * @param {Challenge} challengeB Another listening challenge.
 * @returns {boolean} Whether the two given challenges are the same.
 */
export const isSameListeningChallenge = (
  !!_1.ttsMediaUrl && (_1.ttsMediaUrl === _2.ttsMediaUrl)
  || !!_1.slowTtsMediaUrl && (_1.slowTtsMediaUrl === _2.slowTtsMediaUrl)
);

/**
 * @type {Function}
 * @param {string} localeA A locale.
 * @param {string} localeB Another locale.
 * @returns {boolean} Whether the given locales can be considered identical.
 */
export const isSameLocale = (
  (_1 === _2)
  || (('zh' === _1) && ('zs' === _2))
  || (('zs' === _1) && ('zh' === _2))
);

/**
 * @type {Function}
 * @param {Challenge} challenge A challenge.
 * @returns {string|null} The locale used by the solutions to the given challenge.
 */
export const getSolutionsLocale = it.solutions[0]?.locale || null;

/**
 * @param {Challenge} challenge A challenge.
 * @returns {string|null} The locale used by the statement of the given challenge.
 */
export const getStatementLocale = challenge => (
  isSameLocale(challenge.fromLanguage, getSolutionsLocale(challenge))
    ? challenge.toLanguage
    : challenge.fromLanguage
);

/**
 * Adds matching data to a challenge and the corresponding solutions.
 * @param {Challenge} challenge The challenge.
 * @returns {void}
 */
export const addMatchingData = challenge => {
  if (!isObject(challenge.matchingData)) {
    const locale = getSolutionsLocale(challenge);

    const matchingOptions = {
      ignoreDiacritics: false,
      ignoreWordOrder: true,
    };

    challenge.matchingData = { matchingOptions, locale };

    if (Solution.hasLocaleWordBasedTokens(locale)) {
      const words = new Set();

      challenge.solutions.forEach((solution, index) => {
        Solution.addWordsMatchingData(solution, index, matchingOptions);

        for (const word of solution.matchingData.words) {
          words.add(word);
        }
      });

      challenge.matchingData.words = Array.from(words);
    } else {
      challenge.solutions.forEach(Solution.addSummaryMatchingData(_, _, matchingOptions));
    }
  }
};

/**
 * Matches a user answer against each solution of a challenge, and updates their similarity scores.
 *
 * If it has not been done yet, also adds matching data to the challenge and the corresponding solutions.
 * @param {Challenge} challenge A challenge.
 * @param {string} userAnswer A user answer.
 * @returns {void}
 */
export const addSimilarityScores = (challenge, userAnswer) => {
  addMatchingData(challenge);

  if (('' !== userAnswer) && challenge.matchingData.words) {
    challenge.solutions.forEach(solution => {
      solution.score = Solution.getMatchingScoreWithAnswer(
        solution,
        userAnswer,
        challenge.matchingData.matchingOptions
      );
    });
  }
};

/**
 * @param {object} challenge Raw challenge data from the UI.
 * @returns {import('./solutions.js').Solution[]} The list of solutions to the challenge.
 */
const getUiChallengeSolutions = challenge => {
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
    && UI_NAMING_CHALLENGE_TYPES.includes(challenge.type)
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
    && UI_LISTENING_CHALLENGE_TYPES.includes(challenge.type)
  ) {
    return Solution.fromSentences([ challenge.prompt ], locale);
  }

  if (
    isArray(challenge.correctTokens)
    && UI_WORD_BANK_CHALLENGE_TYPES.includes(challenge.type)
  ) {
    return Solution.fromWordBankTokens(challenge.correctTokens, locale);
  }

  return [];
};

/**
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Challenge[]} The challenges that are relevant to the extension, parsed and ready for use.
 */
export const parseUiChallenges = (uiChallenges, fromLanguage, toLanguage) => {
  return uiChallenges.map(uiChallenge => {
    const solutions = getUiChallengeSolutions(uiChallenge);

    if (solutions.length > 0) {
      const statement = normalizeString(String(uiChallenge.prompt || ''));
      const discussionId = String(uiChallenge.sentenceDiscussionId || '').trim();

      if (
        ('' !== statement)
        && UI_TRANSLATION_CHALLENGE_TYPES.includes(uiChallenge.type)
      ) {
        const type = UI_NAMING_CHALLENGE_TYPES.includes(uiChallenge.type)
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
        UI_LISTENING_CHALLENGE_TYPES.includes(uiChallenge.type)
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
};
