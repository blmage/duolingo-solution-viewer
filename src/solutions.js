import { _, it, lift } from 'one-liner.macro';
import moize from 'moize';
import TextDiff from 'diff';

import {
  cartesianProduct,
  dedupeAdjacent,
  dedupeAdjacentBy,
  groupBy,
  isArray,
  isObject,
  isString,
  max,
  mergeMapsWith,
  partition,
  sumOf,
} from 'duo-toolbox/utils/functions';

import { compareStrings, getStringWords, getWordBigramMap, normalizeString } from './strings';

/**
 * A single vertex of a solution graph.
 *
 * @typedef {object} Vertex
 * @property {?number} to The index of the next vertex, if any.
 * @property {string} lenient The reference value of the vertex.
 * @property {?string} orig The original value of the vertex (if different from its lenient value).
 * @property {?boolean} auto Whether the vertex was automatically derived.
 * @property {?string} type The type of the vertex, only used in special cases.
 */

/**
 * A single part of a solution.
 * A token can hold multiple values, in which case each of them represents a possible choice.
 *
 * @typedef {string[]} Token
 */

/**
 * A possible solution to a challenge.
 *
 * @typedef {object} Solution
 * @property {string} locale The language in which the solution is written.
 * @property {string} reference The first variation of the solution, usable as a reference and for sorting.
 * @property {Token[]} tokens The tokens for building all the possible variations of the solution.
 * @property {boolean} isComplex Whether the solution contains at least one token with multiple values.
 * @property {?MatchingData} matchingData A set of calculated data about the solution, usable for similarity matching.
 * @property {?number} score The similarity score of the solution, in case it has been matched against a user answer.
 */

/**
 * A set of calculated data about a solution, usable for any kind of similarity matching.
 *
 * @typedef {object} MatchingData
 * @property {number} id A unique ID for the solution.
 * @property {?(string[][][])} tokens
 * The tokens of the solution, cleaned up and split into words.
 * The list may be absent if the solution tokens are not based on words.
 * @property {?(string[])} words
 * A list of all the unique words used by the solution tokens.
 * The list may be absent if the solution tokens are not based on words.
 * @property {?string} summary
 * A cleaned up version of the user-friendly summary of all the variations of the solution.
 * The summary is only present if the solution tokens are not based on words.
 */

/**
 * A set of statistics about one or more words, usable for similarity matching using the Sørensen-Dice coefficient.
 *
 * @typedef {object} WordStats
 * @property {number} charCount The total number of characters across the matched words.
 * @property {number} wordCount The total number of matched words.
 * @property {Map} bigramMap A map from bigrams to their number of occurrences in the matched words.
 */

/**
 * @type {Function}
 * @param {string} locale A locale.
 * @returns {boolean} Whether solutions in the given locale use tokens that correspond to words.
 */
export const hasLocaleWordBasedTokens = ![ 'ja', 'zh', 'zs' ].includes(_);

/**
 * A memoized version of {@see compareStrings}, used to efficiently compare words or small strings,
 * which are a sweet spot for memoization.
 *
 * @type {Function}
 * @param {string} x A token string.
 * @param {string} y Another token string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number}
 * A negative value if x comes before y,
 * a positive value if x comes before y,
 * and 0 if both strings are equivalent.
 */
const compareTokenStrings = moize(compareStrings);

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token.
 * @param {string} locale The locale of the vertices.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Vertex[]} The given list, from which duplicate / invalid / irrelevant vertices have been excluded.
 */
const cleanTokenVertices = (vertices, locale, isWhitespaceDelimited) => {
  let result = vertices;
  let filtered;

  // Sometimes, invalid non-auto non-typo copies of valid tokens occur in graphs.
  // Filter out as many of these copies as possible.

  // Filter out copies corresponding to incorrectly expanded contractions,
  // such as "im" replaced by "i am" in words like "him" or "important", resulting in "hi am" or "i amportant".
  // This can only be done safely when the language uses whitespace-delimited tokens,
  // because the corresponding solutions are not accepted due to tokenization.
  if (isWhitespaceDelimited) {
    result = result.filter(!/[^\s]\s+[^\s]/.test(_));
  }

  if ('en' === locale) {
    // Filter out copies containing "&" as an incorrectly contracted variant of "and" within English words.
    result = result.filter(value => (
      (value.length === 1)
      || !value.includes('&')
      || !/(^|[^&\s])&([^&\s]|$)/.test(value))
    );
  } else if ('fr' === locale) {
    // Filter out copies containing "ù" instead of "u" (the only French word with the letter "ù" is "où").
    result = result.filter(value => (
      (value === 'où')
      || (value === 'Où')
      || !value.includes('ù')
    ));
  }

  // Filter out copies containing a "combining dot above" after a lowercase "i".
  // Their combination is invalid, since the "i" is already dotted, contrary to the "I" (which would result in "İ").
  // This previously only occurred in Turkish solutions, but has since been widespread.
  [ filtered, result ] = partition(result, it.includes('i\u0307'));

  if ('tr' !== locale) {
    // Filter out copies containing a lowercase "dotless i" from non-Turkish solutions.
    result = result.filter(!it.includes('ı'));
  }

  if (result.length === 0) {
    // Sometimes, valid words w.r.t. variations of "i" are marked as "auto", and only invalid copies remain.
    // Attempt to correct them rather than returning incomplete solutions.
    result = filtered.map(it.replaceAll('i\u0307', 'i'));
  }

  if (result.length > 1) {
    // Filter out exact copies.
    result = dedupeAdjacent(result.sort(compareTokenStrings(_, _, locale)));
  }

  if (result.length > 1) {
    // Filter out copies that are simplified versions of another vertex.
    // For example: "lhotel" instead of "l'hôtel".
    result = dedupeAdjacentBy(
      result,
      (left, right, simplified) => (
        (right === simplified)
          ? -1
          : (left === simplified) ? 1 : 0
      ),
      it.normalize('NFD')
        .replace(/\p{M}/u, '')
        .replace(/[^\p{L}\p{N}]/u, '')
    );
  }

  return result;
};

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token.
 * @param {string} locale The locale to use for comparing token values.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {{ token: Token, solutionBase: { isComplex: boolean, reference: string }}}
 * The parsed token, and the corresponding solution data.
 */
const parseTokenVertices = (vertices, locale, isWhitespaceDelimited) => {
  let token = cleanTokenVertices(
    vertices.map(vertex => String(vertex.orig || vertex.lenient || '')),
    locale,
    isWhitespaceDelimited
  );

  return {
    token,
    solutionBase: {
      reference: token[0] || '',
      isComplex: token.length > 1,
    },
  };
};

const EMPTY_TOKEN = { size: 0 };

/**
 * @param {object.<number, Vertex[]>[]} groupedVertices
 * A flattened list of groups of vertices taken from a solution graph,
 * arranged by the indices of the corresponding next groups of vertices.
 * @param {number} startIndex The index where to start building partial solutions.
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution[]} The set of all the possible partial solutions starting at the given index.
 */
const fromGroupedVertices = (groupedVertices, startIndex, locale, isWhitespaceDelimited) => {
  if (!groupedVertices[startIndex]) {
    return [];
  }

  if (isArray(groupedVertices[startIndex].solutions)) {
    return groupedVertices[startIndex].solutions;
  }

  let solutions = [];

  for (const key of Object.keys(groupedVertices[startIndex])) {
    const nextIndex = Number(key);
    const vertices = groupedVertices[startIndex][nextIndex];

    const subSolutions = fromGroupedVertices(
      groupedVertices,
      nextIndex,
      locale,
      isWhitespaceDelimited
    );

    const { token, solutionBase } = parseTokenVertices(vertices, locale, isWhitespaceDelimited);

    if (subSolutions.length > 0) {
      for (const subSolution of subSolutions) {
        solutions.push({
          locale,
          reference: solutionBase.reference + subSolution.reference,
          isComplex: solutionBase.isComplex || subSolution.isComplex,
          tokens: (0 === token.length)
            ? subSolution.tokens
            : {
              token,
              next: subSolution.tokens,
              size: subSolution.tokens.size + 1,
            },
        });
      }
    } else if (nextIndex === groupedVertices.length - 1) {
      // The last token is always empty, and shared by all the solutions.
      solutionBase.locale = locale;

      solutionBase.tokens = (0 === token.length)
        ? EMPTY_TOKEN
        : { token, next: EMPTY_TOKEN, size: 1 };

      solutions.push(solutionBase);
    }
  }

  groupedVertices[startIndex].solutions = solutions;

  return solutions;
};

/**
 * @type {Function}
 * @param {Vertex} vertex A vertex from a solution graph.
 * @returns {boolean} Whether the vertex is considered relevant (= is not a typo / was not automatically derived).
 */
const isRelevantVertex = !it.auto && ('typo' !== it.type);

/**
 * @param {Vertex[][]} vertices A flattened list of vertices taken from a solution graph.
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromVertices = (vertices, locale, isWhitespaceDelimited) => {
  let solutions = fromGroupedVertices(
    vertices.map(groupBy(_.filter(isRelevantVertex(_)), it.to)),
    0,
    locale,
    isWhitespaceDelimited
  );

  for (const solution of solutions) {
    let index = 0;
    let element = solution.tokens;
    const tokens = new Array(solution.tokens.size);

    while (element.token) {
      tokens[index++] = element.token;
      element = element.next;
    }

    solution.tokens = tokens;
  }

  // Eliminate the most obvious duplicates. For performance reasons, this does not include:
  // - duplicate complex solutions (sharing the same tokens)
  // - duplicate solutions which do not share the same reference
  solutions = Object.values(groupBy(solutions, it.reference))
    .flatMap(similar => {
      return (similar.length <= 1)
        ? similar
        : (similar.some(it.isComplex) ? similar.filter(it.isComplex) : similar.slice(-1))
    });

  return solutions;
};

/**
 * @param {string[]} sentences A list of sentences.
 * @param {string} locale The locale of the sentences.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromSentences = (sentences, locale) => (
  sentences
    .filter(isString)
    .map(sentence => {
      const reference = normalizeString(sentence);
      const tokens = reference.split(/([\p{L}\p{N}]+)/ug).map([ it ]);

      return {
        locale,
        reference,
        tokens,
        isComplex: false,
      };
    })
);

/**
 * @param {string[]} wordTokens A list of correct tokens from a word bank.
 * @param {string} locale The locale of the words.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromWordBankTokens = (wordTokens, locale) => {
  const words = wordTokens.filter(isString);
  const reference = normalizeString(words.join(' '));

  if ('' !== reference) {
    const tokens = words.flatMap(value => [ [ value ], [ ' ' ] ]);
    tokens.pop();

    return [
      {
        locale,
        reference,
        tokens,
        isComplex: false,
      }
    ];
  }

  return [];
};

/**
 * The (unique) key under which to consolidate reader-friendly strings on a solution.
 *
 * @type {symbol}
 */
const KEY_SUMMARY = Symbol('summary');

/**
 * @param {Solution} solution A solution.
 * @returns {string} A reader-friendly string summarizing all the variations of the given solution.
 */
export const getReaderFriendlySummary = solution => {
  if (!solution[KEY_SUMMARY]) {
    // Add more space between choices and the rest to help with readability when words are not separated by spaces.
    const space = hasLocaleWordBasedTokens(solution.locale) ? '' : ' ';

    solution[KEY_SUMMARY] = solution.tokens.reduce((result, choices) => (
      result + (
        (1 === choices.length)
          ? choices[0]
          : `${space}[${space}${choices.join(' / ')}${space}]${space}`
      )
    ), '');
  }

  return solution[KEY_SUMMARY];
};

/**
 * @param {Solution[]} solutions A list of solutions.
 * @returns {{display: string, plural: number}}
 * An object holding a displayable count and a number usable for pluralization with "preact-i18n".
 */
export const getI18nCounts = solutions => {
  let plural = solutions.length;
  let display = plural.toString();

  if (solutions.some(!!it.isComplex)) {
    ++plural;
    display += '+';
  }

  return { display, plural };
};

/**
 * @param {Solution} x A solution.
 * @param {Solution} y Another solution.
 * @returns {number}
 * The result of the alphabetical comparison between the solution references:
 * - a negative value if x comes before y,
 * - a positive value if x comes after y,
 * - 0 if both solutions have equivalent references.
 */
export function compareByReference(x, y) {
  let result = compareStrings(x.reference, y.reference, x.locale);

  if (0 === result) {
    result = y.isComplex - x.isComplex;
  }

  return result;
}

/**
 * @param {Solution} x A solution.
 * @param {Solution} y Another solution.
 * @returns {number}
 * The result of the comparison between the similarity scores of the solutions:
 * - a negative value if x comes before y,
 * - a positive value if x comes after y,
 *  - 0 if both solutions are similar.
 */
export const compareByScore = (x, y) => {
  const result = (y.score || 0) - (x.score || 0);
  // Note to self: this is the right order.
  return (0 !== result) ? result : compareByReference(x, y);
};

/**
 * @param {string} string A string.
 * @param {string} locale The locale of the string.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 * @returns {string[]} A list of the words contained in the string, prepared for matching based on the given options.
 */
export const getStringMatchableWords = (string, locale, matchingOptions) => (
  getStringWords(normalizeString(string, true, matchingOptions.ignoreDiacritics).toLocaleLowerCase(locale))
);

/**
 * @param {string} token A token.
 * @param {string} locale The locale of the token.
 * @returns {string[]} A list of the words contained in the token, in which diacritics have been preserved.
 */
const getTokenMatchableWordsWithDiacritics = moize(
  (token, locale) => getStringWords(normalizeString(token, true, false).toLocaleLowerCase(locale))
);

/**
 * @param {string} token A token.
 * @param {string} locale The locale of the token.
 * @returns {string[]} A list of the words contained in the token, in which diacritics have been removed.
 */
const getTokenMatchableWordsWithoutDiacritics = moize(
  (token, locale) => getStringWords(normalizeString(token, true, true).toLocaleLowerCase(locale))
);

/**
 * A memoized version of {@see getStringMatchableWords}, used to efficiently extract words from small strings.
 *
 * @param {string} token A token.
 * @param {string} locale The locale of the token.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 * @returns {string[]} A list of the words contained in the token, prepared for matching based on the given options.
 */
const getTokenMatchableWords = (token, locale, matchingOptions) => (
  !matchingOptions.ignoreDiacritics
    ? getTokenMatchableWordsWithDiacritics(token, locale)
    : getTokenMatchableWordsWithoutDiacritics(token, locale)
);

/**
 * Adds matching data to a solution based on the words it contains.
 *
 * @param {Solution} solution A solution.
 * @param {number} id A unique ID to assign to the solution.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 */
export const addWordsMatchingData = (solution, id, matchingOptions) => {
  const allWords = new Set();

  const tokens = solution.tokens
    .map(token => (
      token.map(it.trim())
        .filter('' !== it)
        .map(choice => {
          const words = getTokenMatchableWords(choice, solution.locale, matchingOptions);
          words.forEach(allWords.add(_));
          return words;
        })
    ))
    .filter(it.length > 0);

  solution.matchingData = {
    id,
    tokens,
    words: Array.from(allWords),
  };
};

/**
 * Adds matching data to a solution based on its reader-friendly summary.
 *
 * @param {Solution} solution A solution.
 * @param {number} id A unique ID to assign to the solution.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 */
export const addSummaryMatchingData = (solution, id, matchingOptions) => {
  const baseSummary = normalizeString(
    getReaderFriendlySummary(solution),
    true,
    matchingOptions.ignoreDiacritics
  ).toLocaleLowerCase(solution.locale);

  // Ignore non-word characters at the start / end of the summary, so that all match types are supported and useful.
  const summary = /^[^\p{L}\p{N}]*(.*?)[^\p{L}\p{N}]*?$/ug.exec(baseSummary)?.[1] || baseSummary;

  solution.matchingData = { id, summary };
};

/**
 * @type {WordStats}
 */
const EMPTY_WORD_STATS = {
  charCount: 0,
  wordCount: 0,
  bigramMap: new Map(),
};

/**
 * The (unique) key under which to consolidate word statistics on a solution.
 *
 * @type {symbol}
 */
const KEY_WORD_STATS = Symbol('word_stats');

/**
 * @type {Function}
 * @param {string} word A word.
 * @returns {WordStats} A set of statistics about the given word.
 */
const getWordStats = word => ({
  charCount: word.length,
  wordCount: 1,
  bigramMap: getWordBigramMap(word),
});

/**
 * @type {Function}
 * @param {WordStats[]} stats A set of different word statistics.
 * @returns {WordStats} The union of all the given word statistics.
 */
const mergeWordStats = stats => (
  (0 === stats.length)
    ? EMPTY_WORD_STATS
    : {
      charCount: sumOf(stats, it.charCount),
      wordCount: sumOf(stats, it.wordCount),
      bigramMap: mergeMapsWith(lift(_ + _), ...stats.map(it.bigramMap)),
    }
);

/**
 * @param {Solution} solution A solution.
 * @returns {{ shared: WordStats, paths?: WordStats }}
 * The word statistics for the given solution, split into:
 * - "shared": the statistics for the words shared by all the variations,
 * - "paths": for each variation, the statistics for their unshared words.
 */
const getSolutionWordStats = solution => {
  if (!solution.matchingData) {
    return { shared: EMPTY_WORD_STATS };
  }

  if (!solution[KEY_WORD_STATS]) {
    const {
      false: simpleTokens = [],
      true: complexTokens = [],
    } = groupBy(solution.matchingData.tokens, it.length > 1);

    solution[KEY_WORD_STATS] = {
      shared: mergeWordStats(simpleTokens.flatMap(it[0].map(getWordStats(_)))),
    };

    const choicesWordStats = complexTokens.map(
      it.map(mergeWordStats(_.map(getWordStats(_))))
    );

    if (choicesWordStats.length > 0) {
      const pathsSimilarityData = cartesianProduct(choicesWordStats);
      solution[KEY_WORD_STATS].paths = pathsSimilarityData.map(mergeWordStats);
    }
  }

  return solution[KEY_WORD_STATS];
};

/**
 * @param {Solution} solution A solution.
 * @param {string} answer A user answer.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 * @returns {number[]}
 * The similarity scores (from 0 to 1) between the given answer and each variation of the given solution.
 * The higher the score, the more a variation corresponds to the answer.
 */
const matchAgainstAnswer = (solution, answer, matchingOptions) => {
  const solutionWordStats = getSolutionWordStats(solution);

  const answerWordStats = mergeWordStats(
    getStringMatchableWords(answer, solution.locale, matchingOptions).map(getWordStats)
  );

  const sharedCharCount
    = answerWordStats.charCount
    + solutionWordStats.shared.charCount;

  const sharedWordCount
    = answerWordStats.wordCount
    + solutionWordStats.shared.wordCount;

  let sharedIntersectionSize = 0;

  for (const [ bigram, answerCount ] of answerWordStats.bigramMap) {
    const solutionCount = solutionWordStats.shared.bigramMap.get(bigram) || 0;

    if (solutionCount > 0) {
      sharedIntersectionSize += Math.min(answerCount, solutionCount);
      answerWordStats.bigramMap.set(bigram, Math.max(0, answerCount - solutionCount));
    }
  }

  if (!solutionWordStats.paths) {
    return [ 2.0 * sharedIntersectionSize / (sharedCharCount - sharedWordCount) ];
  }

  return solutionWordStats.paths.map(pathWordStats => {
    let pathIntersectionSize = 0;

    for (const [ bigram, answerCount ] of answerWordStats.bigramMap) {
      const pathCount = pathWordStats.bigramMap.get(bigram) || 0;

      if (pathCount > 0) {
        pathIntersectionSize += Math.min(answerCount, pathCount);
      }
    }

    const totalCharCount = sharedCharCount + pathWordStats.charCount;
    const totalWordCount = sharedWordCount + pathWordStats.wordCount;

    return 2.0 * (sharedIntersectionSize + pathIntersectionSize) / (totalCharCount - totalWordCount);
  });
};

/**
 * @param {Solution} solution A solution.
 * @param {string} answer A user answer.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 * @returns {number}
 * The similarity score (from 0 to 1) between the given solution and the given answer.
 * The higher the score, the more the solution corresponds to the answer.
 */
export const getMatchingScoreWithAnswer = (solution, answer, matchingOptions) => (
  max(matchAgainstAnswer(solution, answer, matchingOptions))
);

/**
 * @param {Solution} solution A solution.
 * @returns {string[]} The variations of the given solution.
 */
export const getAllVariations = cartesianProduct(_.tokens.map(it)).map(it.join(''));

/**
 * @param {Solution} solution A solution.
 * @param {string} answer A user answer.
 * @param {import('./challenges.js').MatchingOptions} matchingOptions A set of matching options.
 * @returns {string[]} The variations from the given solution that best match the given answer.
 */
export const getBestMatchingVariationsForAnswer = (solution, answer, matchingOptions) => {
  if (!solution.isComplex) {
    return [ solution.reference ];
  }

  const tokenCount = solution.tokens.length;

  if (0 === tokenCount) {
    return [];
  }

  const scores = matchAgainstAnswer(solution, answer, matchingOptions);
  const bestScore = max(scores);
  const forkSizes = [ solution.tokens[tokenCount - 1].length, 1 ];

  for (let i = tokenCount - 2; i >= 1; i--) {
    forkSizes.unshift(forkSizes[0] * solution.tokens[i].length);
  }

  return scores.map((score, index) => {
    if (score < bestScore) {
      return null;
    }

    let pathIndex = index;
    let reference = '';

    for (let i = 0; i < tokenCount; i++) {
      if (1 === solution.tokens[i].length) {
        reference += solution.tokens[i][0];
      } else {
        const valueIndex = Math.floor(pathIndex / forkSizes[i]);
        reference += solution.tokens[i][valueIndex];
        pathIndex = pathIndex % forkSizes[i];
      }
    }

    return reference;
  }).filter(isString);
};

/**
 * @typedef {object} DiffToken
 * @property {string} value The value of the token.
 * @property {number} count The length of the token.
 * @property {boolean} added Whether the token was added in the right string.
 * @property {boolean} removed Whether the token was removed in the right string.
 * @property {boolean} ignorable Whether the token is part of a change, but is not significant.
 */

/**
 * @type {Object}
 */
const DIFF_IGNORABLE_VARIANTS = {
  ru: {
    ё: 'е',
  },
};

/**
 * @param {string} string A string.
 * @param {locale} locale The locale of the string.
 * @returns {string} The given string, ready for diffing.
 */
const prepareDiffedString = (string, locale) => {
  const variants = DIFF_IGNORABLE_VARIANTS[locale];
  const result = normalizeString(string).toLocaleLowerCase(locale);

  return !isObject(variants)
    ? result
    : result.replace(new RegExp(`(${Object.keys(variants).join('|')})`, 'g'), lift(variants[_]));
};

/**
 * @param {string} variation A variant of a solution.
 * @param {string} answer A user answer.
 * @param {string} locale The locale of the solution.
 * @returns {DiffToken[]|null}
 * A list of tokens representing the similarities and differences between the two given values
 * (ignoring case, insignificant punctuation marks and spaces),
 * or null if they can be considered equivalent.
 */
export const getVariationDiffWithAnswer = (variation, answer, locale) => {
  // Note: the order of tokens is guaranteed (see https://github.com/kpdecker/jsdiff/issues/14).
  const diffTokens = TextDiff.diffChars(
    prepareDiffedString(variation, locale),
    prepareDiffedString(answer, locale)
  ).flatMap(token => {
    // First run to mark punctuation and separator differences as ignorable.
    const subTokens = [];

    token.added = !!token.added;
    token.removed = !!token.removed;

    if (token.added || token.removed) {
      const matches = [ ...token.value.matchAll(/[\p{P}\p{Z}]+/ug) ];

      const lastIndex = matches.reduce((index, match) => {
        if (match.index > index) {
          subTokens.push({
            added: token.added,
            removed: token.removed,
            value: token.value.substring(index, match.index),
            count: match.index - index,
          });
        }

        subTokens.push({
          added: token.added,
          removed: token.removed,
          ignorable: true,
          value: match[0],
          count: match[0].length,
        });

        return match.index + match[0].length;
      }, 0);

      if ((lastIndex > 0) && (lastIndex < token.value.length)) {
        subTokens.push({
          added: token.added,
          removed: token.removed,
          value: token.value.substring(lastIndex, token.length),
          count: token.value.length - lastIndex,
        });
      }
    }

    if (0 === subTokens.length) {
      subTokens.push(token);
    }

    return subTokens;
  });

  if (!diffTokens.some((it.added || it.removed) && !it.ignorable)) {
    return null;
  }

  // Second run to restore case differences, and mark them as ignorable too.
  const { result } = diffTokens.reduce(({ result, left, right }, token) => {
    if (token.added) {
      token.value = right.substring(0, token.value.length);
      result.push(token);
      return { result, left, right: right.substring(token.value.length) };
    } else if (token.removed) {
      token.value = left.substring(0, token.value.length);
      result.push(token);
      return { result, right, left: left.substring(token.value.length) };
    }

    const subLeft = left.substring(0, token.value.length);
    const subRight = right.substring(0, token.value.length);

    const subTokens = TextDiff.diffChars(subLeft, subRight)

    subTokens.forEach(subToken => {
      subToken.added = !!subToken.added;
      subToken.removed = !!subToken.removed;

      if (subToken.added || subToken.removed) {
        subToken.ignorable = true;
      }
    });

    result.push(...subTokens);

    return {
      result,
      left: left.substring(token.value.length),
      right: right.substring(token.value.length),
    };
  }, {
    result: [],
    left: variation,
    right: answer,
  });

  return result;
};
