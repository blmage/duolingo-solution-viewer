import XRegExp from 'xregexp';
import lodash from 'lodash';
import 'lodash.product';
import moize from 'moize';
import { _, it, lift } from 'param.macro';
import { List, Map } from 'immutable';

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
 * A single part from a solution.
 * A token can hold multiple values, in which case each represents a possible choice.
 *
 * @typedef {string[]} Token
 */

/**
 * A possible solution to a challenge.
 *
 * @typedef {object} Solution
 * @property {string} locale The tag of the language in which the solution is written.
 * @property {string} reference The reference sentence of the solution, usable e.g. for sorting.
 * @property {Array<Token>} tokens The tokens building up all the possible sentences of the solution.
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
 * A regexp for capturing words in a sentence.
 *
 * @constant {RegExp}
 */
const SENTENCE_WORDS_REGEXP = new XRegExp('([\\pL\\pN]+)', 'g');

/**
 * @param {Function} mutator A function applying a series of mutations to a given map.
 * @returns {Map} A new map initialized using the given mutator.
 */
function newMapWith(mutator) {
  return Map().withMutations(mutator);
}

/**
 * @param {Function} merge The function usable to resolve key conflicts.
 * @param {Map} base The base map.
 * @param {Map[]} maps A list of maps to merge into the base map.
 * @returns {Map} The union of all the given maps.
 */
function mergeMapsWith(merge, base, ...maps) {
  return (maps.length > 0) ? base.mergeWith(merge, ...maps) : base;
}

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
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token.
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {{isComplex: boolean, reference: string, token: Token}}
 * The parsed token, and the corresponding solution values.
 */
function parseTokenVertices(vertices, locale, isWhitespaceDelimited) {
  let isComplex;
  let reference;

  let values = Array.from(vertices).map(value => String(value.orig || value.lenient || ''));

  if (isWhitespaceDelimited) {
    // Sometimes non-auto non-typo but still invalid tokens may occur in graphs (it seems to at least happen with some
    // wrongly expanded contractions, such as "im" being replaced by "i am" in words like "him" or "important").
    // We can/should at least filter out those which contain whitespaces when the corresponding language uses
    // whitespace-delimited tokens, because they make for invalid solutions too, due to the tokenization.
    values = values.filter(!/[^\s]\s+[^\s]/.test(_));
  }

  if (values.length > 1) {
    isComplex = true;
    values = lodash.sortedUniqBy(values.sort(compareStrings(_, _, locale)), it);
    reference = values[0];
  } else {
    isComplex = false;
    reference = values[0] || '';
  }

  return { isComplex, reference, token: values, };
}

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution} A solution.
 */
function fromTokenVertices(vertices, locale, isWhitespaceDelimited) {
  const { token, ...solution } = parseTokenVertices(vertices, locale, isWhitespaceDelimited);
  solution.locale = locale;
  solution.tokens = (token.length > 0) ? List.of(token) : List();
  return solution;
}

/**
 * @param {Vertex[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token
 * @param {Solution} solution An existing solution.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution} A new solution, completed with the given vertices.
 */
function prependTokenVertices(vertices, solution, isWhitespaceDelimited) {
  const { token, ...newSolution } = parseTokenVertices(vertices, solution.locale, isWhitespaceDelimited);
  newSolution.isComplex = newSolution.isComplex || solution.isComplex;
  newSolution.reference = newSolution.reference + solution.reference;
  newSolution.tokens = solution.tokens.unshift(token);
  newSolution.locale = solution.locale;
  return newSolution;
}

/**
 * @param {Array.<object.<number, Vertex[]>>} groupedVertices
 * A flattened list of groups of vertices taken from a solution graph, arranged by the corresponding next indices.
 * @param {number} startIndex The index where to start building the sub solutions.
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution[]} A set of sub solutions.
 */
function fromGroupedVertices(groupedVertices, startIndex, locale, isWhitespaceDelimited) {
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

      const subSolutions = fromGroupedVertices(
        groupedVertices,
        index,
        locale,
        isWhitespaceDelimited
      );

      return (subSolutions.length > 0)
        ? subSolutions.map(
          lift(prependTokenVertices(group, _, isWhitespaceDelimited))
        ) : (
          (index !== groupedVertices.length - 1)
            ? []
            : fromTokenVertices(group, locale, isWhitespaceDelimited)
        );
    });
}

/**
 * @param {Vertex} vertex A vertex from a solution graph.
 * @returns {boolean} Whether the vertex is considered relevant (i.e., is not a typo nor was automatically derived).
 */
function isRelevantVertex(vertex) {
  return ('typo' !== vertex.type) && !vertex.auto;
}

/**
 * @param {Vertex[][]} vertices A flattened list of vertices taken from a solution graph.
 * @param {string} locale The locale to use for comparing token strings.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {Solution[]} A set of solutions.
 */
export function fromVertices(vertices, locale, isWhitespaceDelimited) {
  let solutions = fromGroupedVertices(
    vertices.map(lodash.groupBy(_.filter(isRelevantVertex(_)), it.to)),
    0,
    locale,
    isWhitespaceDelimited
  );

  // Eliminate the most obvious duplicates. For performance reasons, this does not include:
  // - duplicate complex solutions (sharing the same tokens)
  // - duplicate solutions which do not share the same reference
  solutions = Object.values(lodash.groupBy(solutions, it.reference))
    .flatMap(similar => {
      return (similar.length <= 1)
        ? similar
        : (similar.some(it.isComplex) ? similar.filter(it.isComplex) : similar.slice(-1))
    });

  // Convert the immutable Lists of tokens to Arrays because the former can't be passed around in messages.
  solutions.forEach(lodash.update(_, 'tokens', lift(Array.from(_).filter(it.length > 0))));

  return solutions;
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
      const tokens = reference.split(SENTENCE_WORDS_REGEXP).map([ it ]);

      return {
        locale,
        reference,
        tokens,
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
    const tokens = words.flatMap(value => [ [ value ], [ ' ' ] ]);
    tokens.pop();

    return [ {
      locale,
      reference,
      tokens,
      isComplex: false,
    } ];
  }

  return [];
}

/**
 * @param {Solution} solution A solution.
 * @returns {string} A user-friendly string summarizing the given solution.
 */
export function toDisplayableString(solution) {
  return solution.tokens.reduce((result, choices) => {
    return result + ((1 === choices.length) ? choices[0] : (`[${choices.join(' / ')}]`));
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
    result = y.isComplex - x.isComplex;
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
  // Note to self: this is the right order.
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
  return (token.length <= 1) && ('' === (token[0] || '').trim());
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
      Array.from(solution.tokens).filter(!isEmptyToken(_)),
      token => token.length > 1
    );

    solution[MATCHING_DATA] = {};
    const locale = solution.locale;

    solution[MATCHING_DATA]['shared'] = mergeMatchingData(
      (tokenGroups['false'] || []).map(getStringMatchingData(_[0], locale))
    );

    const choicesMatchingData = (tokenGroups['true'] || []).map(it.map(getStringMatchingData(_, locale)));

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
