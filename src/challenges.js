import { _, _1, _2, it } from 'one-liner.macro';
import { isArray, isObject, isString } from 'duo-toolbox/utils/functions';

import {
  CHALLENGE_TYPE_TRANSLATION,
  CHALLENGE_TYPE_NAMING,
  CHALLENGE_TYPE_LISTENING,
  EXTENSION_PREFIX,
  SOLUTION_LIST_TYPE_COMPACT,
  SOLUTION_LIST_TYPE_EXPANDED,
  UI_NAMING_CHALLENGE_TYPES,
  UI_LISTENING_CHALLENGE_TYPES,
  UI_WORD_BANK_CHALLENGE_TYPES,
  UI_TRANSLATION_CHALLENGE_TYPES,
} from './constants';

import { normalizeString } from './strings';
import * as Solution from './solutions';

/**
 * A practice challenge.
 * @typedef {object} Challenge
 * @property {number} type The type(s) of the challenge.
 * @property {string} key A key that uniquely identifies the challenge.
 * @property {string} statement The sentence to translate / recognize.
 * @property {SolutionList} solutions The list of accepted solutions to the challenge.
 * @property {string} fromLanguage The language the user speaks.
 * @property {string} toLanguage The language the user learns.
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
 * A set of data about a list of solutions, usable for filtering or matching them.
 * @typedef {object} MatchingData
 * @property {MatchingOptions} options A set of matching options.
 * @property {string} locale The locale of the solutions.
 * @property {?(string[])} words
 * A list of all the words found in the solutions, adapted for matching using the corresponding options.
 * The list may be absent if solutions in the given locale do not use tokens based on words.
 */

/**
 * A list of accepted solutions to a challenge.
 * @typedef {object} SolutionList
 * @property {boolean} parsed Whether all solutions were already parsed from the UI data.
 * @property {string} locale The locale of the solutions.
 * @property {?MatchingData} matchingData A base set of data usable for filtering / matching the solutions.
 *
 * Properties only present if the solutions were already parsed:
 * @property {?string} type The type of the solutions.
 * @property {?import('./solutions.js').Solution[]} list The list of parsed solutions.
 *
 * Properties only present if the solutions were not already parsed:
 * @property {?object} metadata The metadata of the corresponding challenge.
 * @property {?string[]} patterns A list of patterns that can be used to generate "compact" solutions.
 * @property {import('./solutions.js').Vertex[][]} graph A graph that can be used to generate "expanded" solutions.
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
  challenge.key
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
export const getSolutionsLocale = it.solutions.locale || null;

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
 * @param {Challenge} challenge A challenge.
 * @param {string} type The preferred type of solutions to be returned.
 * @returns {SolutionList}
 * A list of parsed solutions for the given challenge.
 * If the requested type is not available, the returned list may be of any type.
 */
export const getParsedSolutionList = (challenge, type) => {
  if (challenge.solutions.parsed) {
    return challenge.solutions;
  }

  let list;
  const { locale, metadata } = challenge.solutions;
  const availableTypes = getAvailableSolutionListTypes(challenge);

  if (!availableTypes.includes(type)) {
    type = availableTypes[0] ?? null;
  }

  if (SOLUTION_LIST_TYPE_EXPANDED === type) {
    list = Solution.fromVertices(
      challenge.solutions.graph,
      locale,
      metadata.isWhitespaceDelimited || Solution.hasLocaleWordBasedTokens(locale)
    );
  } else if (SOLUTION_LIST_TYPE_COMPACT === type) {
    list = Solution.fromCompactTranslations(challenge.solutions.patterns, metadata, locale);
  } else {
    list = [];
  }

  return { parsed: true, locale, type, list };
};

/**
 * @param {Challenge} challenge A challenge.
 * @returns {string[]} The lists of solutions available for the given challenge.
 */
export const getAvailableSolutionListTypes = challenge => (
  (
    challenge.solutions.parsed
    && [ challenge.solutions.type ]
  ) || (
    [
      challenge.solutions.graph && SOLUTION_LIST_TYPE_EXPANDED,
      challenge.solutions.patterns && SOLUTION_LIST_TYPE_COMPACT,
    ].filter(isString)
  )
);

/**
 * Adds matching data to a list of solutions, if not already present.
 * Throws an error if the given list of solutions has not been parsed yet.
 * @param {SolutionList} solutionList A list of solutions.
 * @returns {void}
 */
export const addMatchingDataToSolutionList = solutionList => {
  if (!isObject(solutionList.matchingData)) {
    if (!solutionList.parsed) {
      throw new Error('Cannot add matching data to an unparsed solution list.');
    }

    const locale = solutionList.locale;

    const matchingOptions = {
      ignoreDiacritics: false,
      ignoreWordOrder: true,
    };

    solutionList.matchingData = { matchingOptions, locale };

    if (Solution.hasLocaleWordBasedTokens(locale)) {
      const words = new Set();

      solutionList.list.forEach((solution, index) => {
        Solution.addWordsMatchingData(solution, index, matchingOptions);

        for (const word of solution.matchingData.words) {
          words.add(word);
        }
      });

      solutionList.matchingData.words = Array.from(words);
    } else {
      solutionList.list.forEach(Solution.addSummaryMatchingData(_, _, matchingOptions));
    }
  }
};

/**
 * Matches a user answer against each solution of a list, and updates their similarity scores.
 *
 * If it has not been done yet, also adds matching data to the list of solutions.
 * @param {SolutionList} solutionList A list of solutions.
 * @param {string} userAnswer A user answer.
 * @returns {void}
 */
export const addSimilarityScoresToSolutionList = (solutionList, userAnswer) => {
  addMatchingDataToSolutionList(solutionList);

  if (('' !== userAnswer) && solutionList.matchingData.words) {
    solutionList.list.forEach(solution => {
      solution.score = Solution.getMatchingScoreWithAnswer(
        solution,
        userAnswer,
        solutionList.matchingData.matchingOptions
      );
    });
  }
};

/**
 * @param {object} challenge Raw challenge data from the UI.
 * @returns {SolutionList|null} The list of solutions to the challenge.
 */
const getUiChallengeSolutionList = challenge => {
  const grader = isObject(challenge.grader) ? challenge.grader : {};
  const metadata = isObject(challenge.metadata) ? { ...challenge.metadata } : {};

  const locale = String(
    challenge.targetLanguage
    || grader.language
    || metadata.target_language
    || metadata.language
    || ''
  ).trim();

  const asParsed = (list, type = SOLUTION_LIST_TYPE_COMPACT) => ({ parsed: true, locale, type, list });

  if (
    isArray(challenge.correctSolutions)
    && UI_NAMING_CHALLENGE_TYPES.includes(challenge.type)
  ) {
    return asParsed(Solution.fromSentences(challenge.correctSolutions, metadata, locale));
  }

  const hasCompactTranslations = (
    isArray(challenge.compactTranslations)
    && (challenge.compactTranslations.length > 0)
  );

  const hasGraderGraph = (
    isObject(grader)
    && isArray(grader.vertices)
    && (grader.vertices.length > 0)
  );

  if (hasGraderGraph || hasCompactTranslations) {
    const list = {
      parsed: false,
      locale,
      metadata,
    };

    if (hasGraderGraph) {
      list.graph = grader.vertices;
      metadata.isWhitespaceDelimited = !!grader.whitespaceDelimited;
    }

    if (hasCompactTranslations) {
      list.patterns = challenge.compactTranslations;
    }

    return list;
  }

  if (
    isString(challenge.prompt)
    && ('' !== challenge.prompt)
    && UI_LISTENING_CHALLENGE_TYPES.includes(challenge.type)
  ) {
    return asParsed(Solution.fromSentences([ challenge.prompt ], metadata, locale));
  }

  if (
    isArray(challenge.correctTokens)
    && UI_WORD_BANK_CHALLENGE_TYPES.includes(challenge.type)
  ) {
    return asParsed(Solution.fromWordBankTokens(challenge.correctTokens, metadata, locale));
  }

  return null;
};

/**
 * @param {object[]} uiChallenges A set of raw challenge data from the UI.
 * @param {string} fromLanguage The language the user speaks.
 * @param {string} toLanguage The language the user learns.
 * @returns {Challenge[]} The challenges that are relevant to the extension, parsed and ready for use.
 */
export const parseUiChallenges = (uiChallenges, fromLanguage, toLanguage) => {
  return uiChallenges.map(uiChallenge => {
    const solutions = getUiChallengeSolutionList(uiChallenge);

    if (solutions) {
      const key = String(uiChallenge.id || Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).trim();
      const statement = normalizeString(String(uiChallenge.prompt || ''));

      if (
        ('' !== statement)
        && UI_TRANSLATION_CHALLENGE_TYPES.includes(uiChallenge.type)
      ) {
        const type = UI_NAMING_CHALLENGE_TYPES.includes(uiChallenge.type)
          ? CHALLENGE_TYPE_NAMING
          : CHALLENGE_TYPE_TRANSLATION;

        return {
          key,
          type,
          statement,
          solutions,
          fromLanguage,
          toLanguage,
        };
      } else if (
        UI_LISTENING_CHALLENGE_TYPES.includes(uiChallenge.type)
        && ('' !== String(uiChallenge.solutionTranslation || '').trim())
      ) {
        const solutionTranslation = normalizeString(String(uiChallenge.solutionTranslation));
        const ttsMediaUrl = String(uiChallenge.tts || '').trim();
        const slowTtsMediaUrl = String(uiChallenge.slowTts || '').trim();

        return {
          key,
          type: CHALLENGE_TYPE_LISTENING,
          statement,
          solutions,
          fromLanguage,
          toLanguage,
          solutionTranslation,
          ttsMediaUrl,
          slowTtsMediaUrl,
        };
      }
    }
  }).filter(isObject);
};
