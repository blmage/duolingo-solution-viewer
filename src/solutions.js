import lodash from 'lodash';
import 'lodash.product';
import moize from 'moize';
import { _, it, lift } from 'param.macro';
import { List, Map } from 'immutable';
import { isEmptyObject } from './functions';

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
const SENTENCE_WORDS_REGEXP = /([A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEF\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7BF\uA7C2-\uA7C6\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB67\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D58-\u0D5E\u0D66-\u0D78\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]+)/gu;

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
 * A memoized version of compareStrings, used to efficiently compare words or small strings, which are a sweet spot
 * for memoization.
 * 
 * @function
 * @param {string} x A token string.
 * @param {string} y Another token string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number}
 * A negative value if x comes before y, a positive value if x comes before y, and 0 if both strings are equivalent.
 */
const compareTokenStrings = moize(compareStrings);

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
    values = lodash.sortedUniqBy(values.sort(compareTokenStrings(_, _, locale)), it);
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
    || isEmptyObject(groupedVertices[startIndex])
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
