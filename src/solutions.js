import XRegExp from 'xregexp';
import lodash from 'lodash';
import moize from 'moize';
import { List, Map } from 'immutable';
import { _, it, lift } from 'param.macro';
import { mergeMapsWith, newMapWith } from './functions';
import { SENTENCE_WORDS_REGEXP, TRIMMED_WORDS_REGEXP } from './constants';

/**
 * A single vertex from a solution graph.
 *
 * @typedef {object} Vertex
 * @property {?number} to The index of the next vertex, if there is any.
 * @property {string} lenient The reference value of the vertex.
 * @property {?string} orig The original value of the vertex (if different from its lenient value).
 * @property {?boolean} auto Whether the vertex was automatically derived.
 * @property {?string} type The type of the vertex, only used for particular cases.
 */

/**
 * A single choice from a solution token.
 *
 * @typedef {object} TokenValue
 * @property {boolean} isAutomatic Whether the token value was automatically derived from another value.
 * @property {string} value The actual value.
 */

/**
 * A single element from a solution.
 * A token can hold multiple values, in which case each represents a possible choice.
 *
 * @typedef {TokenValue[]} Token
 */

/**
 * A possible solution to a challenge.
 *
 * @typedef {object} Solution
 * @property {string} locale The tag of the language in which the solution is written.
 * @property {string} reference The reference sentence of the solution, usable e.g. for sorting.
 * @property {List<Token>} tokens The list of tokens building up all the possible sentences of the solution.
 * @property {boolean} hasAutomatic Whether the solution contains at least one token with one automatic value.
 * @property {boolean} isAutomatic Whether the solution contains at least one token with only automatic values.
 * @property {boolean} isComplex Whether the solution contains at least one token with multiple values.
 * @property {?number} score The similarity score of the solution (only when matched against an answer).
 */

/**
 * A set of statistics about one or more words, used for similarity matching.
 *
 * @typedef {object} MatchingData
 * @property {number} charCount The total number of characters across the matched words.
 * @property {number} wordCount The total number of matched words.
 * @property {Map} bigramMap A map from bigrams to their number of occurrences in the matched words.
 */

/**
 * Compares two strings using a pre-defined set of collation rules.
 *
 * @param {string} x A string.
 * @param {string} y Another string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number}
 * A negative value if x comes before y, a positive value if x comes before y, and 0 if both strings are equivalent. 
 */
function compareStrings(x, y, locale) {
  return x.localeCompare(y, locale, {
    ignorePunctuation: true,
    numeric: true,
    sensitivity: 'accent',
    usage: 'sort',
  });
}

/**
 * @param {string} x A token string.
 * @param {string} y Another token string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {boolean} Whether the two token strings are significantly different.
 */
function hasVertexRelevantDifferences(x, y, locale) {
  x = x.toLocaleLowerCase(locale);
  y = y.toLocaleLowerCase(locale);

  if (x !== y) {
    x = (XRegExp.exec(x, TRIMMED_WORDS_REGEXP) || [ '' ])[0];
    y = (XRegExp.exec(y, TRIMMED_WORDS_REGEXP) || [ '' ])[0];
    return (x !== y);
  }

  return false;
}

/**
 * @param {Vertex} vertex A vertex taken from a solution graph.
 * @param {string} locale The locale to use for comparing token strings.
 * @returns {TokenValue[]} The token values corresponding to the given vertex.
 */
function getVertexTokenValues(vertex, locale) {
  const isAutomatic = !!vertex.auto;

  if (
    lodash.isString(vertex.orig)
    && lodash.isString(vertex.lenient)
    && hasVertexRelevantDifferences(vertex.lenient, vertex.orig, locale)
  ) {
    return [
      {
        isAutomatic,
        value: vertex.orig,
      },
      {
        isAutomatic: true,
        value: vertex.lenient,
      }
    ];
  }

  return [
    {
      isAutomatic,
      value: String(vertex.orig || vertex.lenient || ''),
    }
  ];
}

/**
 * @param {TokenValue} x A token value.
 * @param {TokenValue} y Another token value.
 * @param {string} locale The locale to use for comparing the token strings.
 * @returns {number}
 * A negative value if x is more relevant than y, a positive value if x is less relevant than y, and 0 if both token
 * values are equally relevant.
 */
function compareTokenValues(x, y, locale) {
  const result = compareStrings(x.value, y.value, locale);
  return (0 !== result) ? result : (x.isAutomatic - y.isAutomatic);
}

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token.
 * @param {string} locale The locale to use for comparing token strings.
 * @returns {{hasAutomatic: boolean, isAutomatic: boolean, isComplex: boolean, reference: string, token: Token}}
 * The parsed token, and the corresponding solution values.
 */
function parseTokenVertices(vertices, locale) {
  let hasAutomatic;
  let isAutomatic;
  let isComplex;
  let reference;

  let values = Array.from(vertices).flatMap(getVertexTokenValues(_, locale));

  if (values.length > 1) {
    hasAutomatic = values.some(it.isAutomatic);
    isAutomatic = hasAutomatic && values.every(it.isAutomatic);
    isComplex = true;
    values = lodash.sortedUniqBy(values.sort(compareTokenValues(_, _, locale)), it.value);
    reference = (hasAutomatic && values.find(!it.isAutomatic) || values[0]).value;
  } else {
    hasAutomatic = !!values[0].isAutomatic;
    isAutomatic = hasAutomatic;
    isComplex = false;
    reference = values[0].value;
  }

  return {
    hasAutomatic,
    isAutomatic,
    isComplex,
    reference,
    token: values
  };
}

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token
 * @param {string} locale The locale to use for comparing token strings.
 * @returns {Solution} A solution.
 */
function fromTokenVertices(vertices, locale) {
  const { token, ...result } = parseTokenVertices(vertices, locale);
  result.locale = locale;
  result.tokens = List.of(token);
  return result;
}

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token
 * @param {Solution} solution An existing solution.
 * @returns {Solution} A new solution, completed with the given vertices.
 */
function prependTokenVertices(vertices, solution) {
  const { token, ...result } = parseTokenVertices(vertices, solution.locale);
  result.hasAutomatic = result.hasAutomatic || solution.hasAutomatic;
  result.isAutomatic = result.isAutomatic || solution.isAutomatic;
  result.isComplex = result.isComplex || solution.isComplex;
  result.reference = result.reference + solution.reference;
  result.tokens = solution.tokens.unshift(token);
  result.locale = solution.locale;
  return result;
}

/**
 * @param {Array.<object.<number, Vertex[]>>} groupedVertices
 * A flattened list of groups of vertices taken from a solution graph, arranged by the corresponding next indices.
 * @param {number} startIndex The index where to start building the sub solutions.
 * @param {string} locale The locale to use for comparing token strings.
 * @returns {Solution[]} A set of sub solutions.
 */
function fromGroupedVertices(groupedVertices, startIndex, locale) {
  if (
    !groupedVertices[startIndex]
    || !lodash.isPlainObject(groupedVertices[startIndex])
    || lodash.isEmpty(groupedVertices[startIndex])
  ) {
    return [];
  }

  return Object.entries(groupedVertices[startIndex])
    .flatMap(([ key, group ]) => {
      const index = Number(key);
      const subSolutions = fromGroupedVertices(groupedVertices, index, locale);

      return (subSolutions.length > 0)
        ? subSolutions.map(lift(prependTokenVertices(group, _)))
        : ((index !== groupedVertices.length - 1) ? [] : fromTokenVertices(group, locale));
    });
}

/**
 * @param {Vertex} vertex A vertex from a solution graph.
 * @param {boolean} allowAutomatic Whether automatically derived vertices are allowed.
 * @returns {boolean} Whether the vertex is considered to be relevant.
 */
function isRelevantVertex(vertex, allowAutomatic) {
  return ('typo' !== vertex.type) && (allowAutomatic || !vertex.auto);
}

/**
 * @param {Vertex[][]} vertices A flattened list of vertices taken from a solution graph.
 * @param {boolean} includeAutomatic Whether automatically derived vertices should be included in the solutions.
 * @param {string} locale The locale to use for comparing token strings.
 * @returns {Solution[]} A set of solutions.
 */
export function fromVertices(vertices, includeAutomatic, locale) {
  return fromGroupedVertices(vertices.map(
    lodash.groupBy(
      _.filter(isRelevantVertex(_, includeAutomatic)),
      it.to
    )
  ), 0, locale);
}

/**
 * @param {string[]} solutions A list of correct solutions for a naming challenge.
 * @param {string} locale The locale of the challenge.
 * @returns {Solution[]} A set of solutions.
 */
export function fromNamingSolutions(solutions, locale) {
  return solutions
    .filter(lodash.isString)
    .map(solution => {
      const reference = solution.normalize().trim();

      const tokens = reference
        .split(SENTENCE_WORDS_REGEXP)
        .map(value => [ { value, isAutomatic: false } ]);

      return {
        locale,
        reference,
        tokens: List(tokens),
        hasAutomatic: false,
        isAutomatic: false,
        isComplex: false,
      };
    });
}

/**
 * @param {string[]} wordTokens A list of correct tokens from a word bank.
 * @param {string} locale The locale of the corresponding challenge.
 * @returns {Solution[]} A set of solutions.
 */
export function fromWordBankTokens(wordTokens, locale) {
  const words = wordTokens
    .filter(lodash.isString)
    .map(token => token.normalize());

  const reference = words.join(' ').trim();

  if ('' !== reference) {
    const spaceToken = [ { value: ' ', isAutomatic: false } ];
    const tokens = words.map(value => [ { value, isAutomatic: false } ]);

    return [ {
      locale,
      reference,
      tokens: List(tokens).interpose(spaceToken),
      hasAutomatic: false,
      isAutomatic: false,
      isComplex: false,
    } ];
  }

  return [];
}

/**
 * @param {Solution} solution A solution.
 * @param {boolean} includeAutomatic Whether automatically derived tokens should be included in the summary.
 * @returns {string} A user-friendly string summarizing the given solution.
 */
export function toDisplayableString(solution, includeAutomatic) {
  return solution.tokens.reduce((result, token) => {
    const choices = includeAutomatic ? token : token.filter(!it.isAutomatic);

    const choice = (1 === choices.length)
      ? choices[0].value
      : (`[${choices.map(it.value).join(' / ')}]`);

    return result + choice;
  }, '');
}

/**
 * @param {Solution} x A solution.
 * @param {Solution} y Another solution.
 * @returns {number}
 * The result of the alphabetical comparison between the solution references. A negative value if x comes before y,
 * a positive value if x comes after y, and 0 if both solutions have equivalent references.
 */
export function compareValues(x, y) {
  let result = compareStrings(x.reference, y.reference, x.locale);

  if (0 === result) {
    result = x.isAutomatic - y.isAutomatic;

    if (0 === result) {
      result = x.isComplex - y.isComplex;
    }
  }

  return result;
}

/**
 * @param {Solution} x A solution.
 * @param {Solution} y Another solution.
 * @returns {number}
 * The result of the comparison between the similarity scores of the solutions. A negative value if x comes before y,
 * a positive value if x comes after y, and 0 if both solutions are similar.
 */
export function compareScores(x, y) {
  const result = (y.score || 0) - (x.score || 0);
  return (0 !== result) ? result : compareValues(x, y);
}

/**
 * @param {Solution[]} solutions A set of solutions.
 * @returns {{display: string, plural: number}}
 * An object holding a displayable count and a number usable for pluralization.
 */
export function getI18nCounts(solutions) {
  let plural = solutions.length;
  let display = plural.toString();

  if (solutions.some(!!it.isComplex)) {
    ++plural;
    display += '+';
  }

  return { display, plural };
}

/**
 * @param {Token} token A solution token.
 * @returns {boolean} Whether the given token is empty.
 */
function isEmptyToken(token) {
  return (1 === token.length) && ('' === token[0].value.trim());
}

/**
 * @param {Map} map A map from bigrams to the corresponding number of occurrences.
 * @param {string} word A word.
 * @returns {Map} A new map, updated with the bigrams of the given word.
 */
function addWordBigramsToMap(map, word) {
  if (1 === word.length) {
    return map.set(word, (map.get(word) || 0) + 1);
  }

  for (let i = 0, l = word.length - 1; i < l; i++) {
    const bigram = word.substring(i, i + 2);
    map.set(bigram, (map.get(bigram) || 0) + 1);
  }

  return map;
}

/**
 * @type {MatchingData}
 */
const emptyMatchingData = {
  charCount: 0,
  wordCount: 0,
  bigramMap: Map(),
};

/**
 * @function
 * @param {string} string A string.
 * @param {string} locale The locale of the string.
 * @returns {MatchingData} The similarity matching data of the given string.
 */
const getStringMatchingData = moize(
  (string, locale) => {
    const words = string.trim()
      .normalize()
      .toLocaleLowerCase(locale)
      .match(SENTENCE_WORDS_REGEXP);

    return (null === words)
      ? emptyMatchingData
      : {
        charCount: lodash.sumBy(words, it.length),
        wordCount: words.length,
        bigramMap: newMapWith(map => words.reduce(addWordBigramsToMap(_, _), map)),
      };
  }
);

/**
 * @param {MatchingData[]} data A set of similarity matching data.
 * @returns {MatchingData} The union of all the given matching data.
 */
function mergeMatchingData(data) {
  return (0 === data.length)
    ? emptyMatchingData
    : {
      charCount: lodash.sumBy(data, it.charCount),
      wordCount: lodash.sumBy(data, it.wordCount),
      bigramMap: mergeMapsWith(lodash.add, ...data.map(it.bigramMap)),
    };
}

/**
 * The (unique) key under which similarity matching data is consolidated in a solution.
 *
 * @type {symbol}
 */
const MATCHING_DATA = Symbol('matching_data');

/**
 * @param {Solution} solution A solution.
 * @returns {{ shared: MatchingData, paths: MatchingData }}
 * The similarity matching data for the given solution, split into:
 * - "shared": the matching data for the words shared by all the possible sentences,
 * - "paths":  for each possible sentence, the matching data for their exclusive words.
 */
function getSolutionMatchingData(solution) {
  if (!solution[MATCHING_DATA]) {
    const tokenGroups = lodash.groupBy(
      solution.tokens.toArray().filter(!isEmptyToken(_)),
      token => token.length > 1
    );

    solution[MATCHING_DATA] = {};
    const locale = solution.locale;

    solution[MATCHING_DATA]['shared'] = mergeMatchingData(
      (tokenGroups['false'] || []).map(getStringMatchingData(_[0].value, locale))
    );

    const choicesMatchingData = (tokenGroups['true'] || []).map(it.map(getStringMatchingData(_.value, locale)));

    if (choicesMatchingData.length > 0) {
      const pathsMatchingData = lodash.product.apply(null, choicesMatchingData);
      solution[MATCHING_DATA]['paths'] = pathsMatchingData.map(mergeMatchingData);
    }
  }

  return solution[MATCHING_DATA];
}

/**
 * @param {Solution} solution A solution.
 * @param {string} answer A user answer.
 * @returns {number}
 * The similarity score between the given solution and answer, ranging from 0 (100% different) to 1 (100% similar).
 */
export function matchAgainstAnswer(solution, answer) {
  const solutionMatchingData = getSolutionMatchingData(solution);

  const locale = solution.locale;
  const answerMatchingData = getStringMatchingData(answer, locale);

  const sharedCharCount
    = answerMatchingData.charCount
    + solutionMatchingData.shared.charCount;

  const sharedWordCount
    = answerMatchingData.wordCount
    + solutionMatchingData.shared.wordCount;

  let sharedIntersectionSize = 0;

  const answerBigramMap = answerMatchingData.bigramMap.map((answerCount, bigram) => {
    const solutionCount = solutionMatchingData.shared.bigramMap.get(bigram) || 0;

    if (solutionCount > 0) {
      sharedIntersectionSize += Math.min(answerCount, solutionCount);
      return Math.max(0, answerCount - solutionCount);
    }

    return answerCount;
  });

  if (!solutionMatchingData['paths']) {
    return 2.0 * sharedIntersectionSize / (sharedCharCount - sharedWordCount);
  }

  const scores = solutionMatchingData['paths'].map(pathMatchingData => {
    const pathIntersectionSize = answerBigramMap.reduce(
      (size, answerCount, bigram) => size + Math.min(answerCount, pathMatchingData.bigramMap.get(bigram) || 0),
      0
    );

    const totalCharCount = sharedCharCount + pathMatchingData.charCount;
    const totalWordCount = sharedWordCount + pathMatchingData.wordCount;

    return 2.0 * (sharedIntersectionSize + pathIntersectionSize) / (totalCharCount - totalWordCount);
  });

  return Math.max.apply(null, scores);
}
