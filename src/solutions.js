import { _, it, lift } from 'one-liner.macro';
import moize from 'moize';
import TextDiff from 'diff';
import * as wanakana from 'wanakana';

import {
  cartesianProduct,
  dedupeAdjacent,
  dedupeAdjacentBy,
  dedupeBy,
  groupBy,
  hasObjectProperty,
  identity,
  isArray,
  isEmptyObject,
  isObject,
  isString,
  max,
  mergeMapsWith,
  partition,
  sumOf,
} from 'duo-toolbox/utils/functions';

import { compareStrings, compareStringsCi, getStringWords, getWordBigramMap, normalizeString } from './strings';

/**
 * A single vertex of a solution graph.
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
 * @typedef {string[]} Token
 */

/**
 * A possible solution to a challenge.
 * @typedef {object} Solution
 * @property {string} locale The language in which the solution is written.
 * @property {string} reference The first variation of the solution, usable as a reference and for sorting.
 * @property {Token[]} tokens The tokens for building all the possible variations of the solution.
 * @property {boolean} isComplex Whether the solution contains at least one token with multiple values.
 * @property {?number} flags A mask of the flags from the locale's flag filters that are matched by the solution.
 * @property {?MatchingData} matchingData A set of calculated data about the solution, usable for similarity matching.
 * @property {?number} score The similarity score of the solution, in case it has been matched against a user answer.
 */

/**
 * A set of calculated data about a solution, usable for any kind of similarity matching.
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
 * @typedef {object} WordStats
 * @property {number} charCount The total number of characters across the matched words.
 * @property {number} wordCount The total number of matched words.
 * @property {Map} bigramMap A map from bigrams to their number of occurrences in the matched words.
 */

/**
 * A set of patterns for generating a list of solutions.
 * @typedef {object} PatternSet
 * @property {string} locale The locale of the generated solutions.
 * @property {number} size The number of solutions that the patterns can generate.
 * @property {Pattern[]} patterns The patterns that can be used to generate all the solutions.
 */

/**
 * A pattern for generating a list of solutions.
 * @typedef {object} Pattern
 * @property {number} size The number of solutions that the pattern can generate.
 * @property {number} flags A mask of the flags matched by the generated solutions.
 * @property {string[]} sharedTokens The tokens that are shared by all the generated solutions.
 * @property {PatternBranchSet[]} branchSets The sets of branches that build up the paths leading to different solutions.
 */

/**
 * A set of branches for generating solutions of different shapes.
 * @typedef {object} PatternBranchSet
 * @property {number} branchSize The number of solutions that stem from each branch of the set.
 * @property {number} tokenPosition The position of the branches tokens relative to the pattern shared tokens.
 * @property {PatternBranch[]} branches The branches that build up the paths leading to different solutions.
 */

/**
 * A branch for generating solutions based on a similar shape, with possible choices at the start and/or end.
 * @typedef {object} PatternBranch
 * @property {string[]} sharedTokens The tokens that are shared by all the solutions based on the branch.
 * @property {string[]} firstChoice The possible tokens at the start of the branch (if there is a choice first).
 * @property {string[]} lastChoice The possible tokens at the end of the branch (if there is a choice last).
 */

export const SOLUTION_FLAG_HIRAGANA = 1 << 0;
export const SOLUTION_FLAG_KANJI = 1 << 1;
export const SOLUTION_FLAG_KATAKANA = 1 << 2;
export const SOLUTION_FLAG_ROMAJI = 1 << 3;

export const LOCALE_FLAG_FILTER_SETS = {
  ja: {
    labelKey: 'syllabary',
    defaultLabel: 'Syllabary:',
    hintKey: 'syllabary_filter_description',
    defaultHint: 'Select one or more Japanese syllabaries to see only the corresponding solutions.',
    filters: [
      {
        flag: SOLUTION_FLAG_HIRAGANA,
        labelKey: 'hiragana',
        defaultLabel: 'Hiragana',
        default: true,
      },
      {
        flag: SOLUTION_FLAG_KANJI,
        labelKey: 'kanji',
        defaultLabel: 'Kanji',
        default: true,
      },
      {
        flag: SOLUTION_FLAG_KATAKANA,
        labelKey: 'katakana',
        defaultLabel: 'Katakana',
      },
      {
        flag: SOLUTION_FLAG_ROMAJI,
        labelKey: 'romaji',
        defaultLabel: 'Romaji',
      },
    ],
  },
};

/**
 * @type {Function}
 * @param {string} locale A locale.
 * @returns {boolean} Whether solutions in the given locale use tokens that correspond to words.
 */
export const hasLocaleWordBasedTokens = ![ 'ja', 'zh', 'zs' ].includes(_);

/**
 * @param {Function} fn A function over strings.
 * @param {boolean} isSingleArity Whether the function takes a single string argument.
 * @returns {Function} A memoized version of the given function.
 */
const memoizeStringFunction = (fn, isSingleArity = false) => {
  let cache = {};
  let memoized;

  if (isSingleArity) {
    memoized = x => {
      if (!hasObjectProperty(cache, x)) {
        cache[x] = fn(x);
      }

      return cache[x];
    };
  } else {
    memoized = (...args) => {
      const key = args.join('\x1f');

      if (!hasObjectProperty(cache, key)) {
        cache[key] = fn(...args);
      }

      return cache[key];
    };
  }

  memoized.clearCache = () => {
    cache = {};
  };

  return memoized;
};

/**
 * A memoized version of {@see compareStrings}, used to efficiently compare words or small strings.
 * @type {Function}
 * @param {string} x A token string.
 * @param {string} y Another token string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number} -1 if x comes before y, 1 if x comes after y, and 0 if both strings are equal.
 */
const compareTokenStrings = memoizeStringFunction(compareStrings);

/**
 * A memoized version of {@see compareStringsCi}, used to efficiently compare words or small strings.
 * @type {Function}
 * @param {string} x A token string.
 * @param {string} y Another token string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number} -1 if x comes before y, 1 if x comes after y, and 0 if both strings are equal.
 */
const compareTokenStringsCi = memoizeStringFunction(compareStringsCi);

/**
 * @type {Function}
 * @param {string} x A string from a token.
 * @param {string} locale The locale of the string.
 * @returns {string} A simplified version of the given string.
 */
const simplifyTokenString = memoizeStringFunction((x, locale) => (
  x.toLocaleLowerCase(locale)
    .normalize('NFD')
    .replace(/\p{M}/ug, '')
    .replace(/[^\p{L}\p{N}]/ug, '')
    .normalize('NFC')
), true);

const JAPANESE_TOKEN_TYPE_FLAG = {
  en: SOLUTION_FLAG_ROMAJI,
  hiragana: SOLUTION_FLAG_HIRAGANA,
  katakana: SOLUTION_FLAG_KATAKANA,
  kanji: SOLUTION_FLAG_KANJI,
};

/**
 * @type {Function}
 * @param {string} sentence A Japanese sentence.
 * @returns {number} A mask of the flags that are matched by the sentence.
 */
const getJapaneseSentenceFilterFlags = lift(
  wanakana
    .tokenize(_, { detailed: true })
    .map(JAPANESE_TOKEN_TYPE_FLAG[it.type] ?? 0)
    .reduce(lift(_ | _), 0)
);

/**
 * A memoized version of {@see getJapaneseSentenceFilterFlags}.
 * @type {Function}
 * @param {string} token A Japanese token.
 * @returns {number} A mask of the flags that are matched by the token.
 */
const getJapaneseTokenFilterFlags = memoizeStringFunction(getJapaneseSentenceFilterFlags, true);

/**
 * @param {string[]} vertices A list of vertices taken from a solution graph, and corresponding to a single token.
 * @param {string} locale The locale of the vertices.
 * @param {boolean} isWhitespaceDelimited Whether tokens are whitespace-delimited.
 * @returns {string[]} The given list, from which duplicate / invalid / irrelevant vertices have been excluded.
 * Additional information may be added to the list:
 * - suffix: the punctuation that is common to all the vertices, if any.
 * - flags: a mask of the flags from the locale's flag filters that are matched by the token.
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
  } else if ('de' === locale) {
    // Filter out copies to which an invalid umlaut has been added.
    // We make use of the fact that all valid words containing an umlaut can be found together with a simplified copy.
    const umlauts = [ 'ä', 'ö', 'ü' ];
    const simplified = [ 'ae', 'oe', 'ue' ];

    for (let i = 0; i <= umlauts.length; i++) {
      if (
        result.includes(it.includes(umlauts[i]))
        && !result.includes(it.includes[simplified[i]])
      ) {
        result = result.filter(it.includes(umlauts[i]));
      }
    }
  }

  // Filter out copies containing a "combining dot above" after a lowercase "i".
  // Their combination is invalid, since the "i" is already dotted, contrary to the "I" (which would result in "İ").
  // This previously only occurred in Turkish solutions, but has since been widespread.
  [ filtered, result ] = partition(result, it.includes('i\u0307'));

  if ('tr' !== locale) {
    // Filter out copies containing a "dotless i" or a "dotted I" from non-Turkish solutions.
    result = result.filter(!it.includes('ı') && !it.includes('I\u0307'));
  }

  if (result.length === 0) {
    // Sometimes, valid words w.r.t. variations of "i" are marked as "auto", and only invalid copies remain.
    // Attempt to correct them rather than returning incomplete solutions.
    result = filtered.map(it.replaceAll('i\u0307', 'i').replaceAll('I\u0307', 'I'));
  }

  if (result.length > 1) {
    // Filter out exact copies.
    result = dedupeAdjacent(result.sort(compareTokenStringsCi(_, _, locale)));
  }

  if (result.length > 1) {
    // Filter out copies that are simplified versions of another vertex.
    // For example: "lhotel" instead of "l'hôtel".
    result = dedupeAdjacentBy(
      result,
      (left, right, simplified) => {
        // If any version contains accents and not the other, keep the accented one only.
        const isLeftSimplified = compareTokenStringsCi(left, simplified, locale) === 0
        const isRightSimplified = compareTokenStringsCi(right, simplified, locale) === 0;

        if (isLeftSimplified) {
          if (!isRightSimplified) {
            return 1;
          }
        } else if (isRightSimplified) {
          return -1;
        }

        // If any version is longer than the other, keep it, assuming that the more punctuation the better.
        if (left.length > right.length) {
          return -1;
        } else if (right.length > left.length) {
          return 1;
        }

        // If only case differs, keep the upper-cased version.
        if (compareTokenStringsCi(left, right, locale) === 0) {
          const caseResult = compareTokenStrings(left, right, locale);

          if (caseResult !== 0) {
            return caseResult;
          }
        }

        // If only punctuation differ, arbitrarily keep the first version. Otherwise, keep both.
        return isLeftSimplified ? -1 : 0;
      },
      simplifyTokenString(_, locale)
    );
  }

  // Move punctuation outside the choices if it is common to all of them.
  if (result.length > 1) {
    let punctuation = result[0].match(/([^\p{L}\p{N}]+)$/u);

    if (punctuation) {
      for (let i = 1; i < result.length; i++) {
        if (!result[i].endsWith(punctuation[1])) {
          punctuation = null;
          break;
        }
      }
    }

    if (punctuation) {
      // Do not filter out empty tokens here, as they signify that other choices are optional.
      result = result.map(it.slice(0, -punctuation[1].length));
      result.suffix = punctuation[1];
    }
  }

  if ('ja' === locale) {
    result.flags = result.map(getJapaneseTokenFilterFlags(_)).reduce(lift(_ | _), 0);
  } else {
    result.flags = 0;
  }

  return result;
};

const EMPTY_TOKEN = { size: 0 };

/**
 * @param {{[key: number]: Vertex[]}[]} groupedVertices
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
    const token = groupedVertices[startIndex][nextIndex];
    let appendNextTokens;

    if (token.length === 0) {
      appendNextTokens = identity;
    } else if (!token.suffix) {
      appendNextTokens = lift({
        token,
        next: it,
        size: it.size + 1,
      });
    } else {
      appendNextTokens = lift({
        token,
        next: {
          token: [ token.suffix ],
          next: it,
          size: it.size + 1,
        },
        size: it.size + 2,
      });
    }

    const solutionBase = {
      reference: token[0] || '',
      flags: token.flags,
      isComplex: token.length > 1,
    };

    const subSolutions = fromGroupedVertices(
      groupedVertices,
      nextIndex,
      locale,
      isWhitespaceDelimited
    );

    if (subSolutions.length > 0) {
      for (const subSolution of subSolutions) {
        solutions.push({
          locale,
          reference: solutionBase.reference + subSolution.reference,
          flags: solutionBase.flags | subSolution.flags,
          isComplex: solutionBase.isComplex || subSolution.isComplex,
          tokens: appendNextTokens(subSolution.tokens),
        });
      }
    } else if (nextIndex === groupedVertices.length - 1) {
      // The last token is always empty, and shared by all the solutions.
      solutionBase.locale = locale;
      solutionBase.tokens = appendNextTokens(EMPTY_TOKEN);
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
  const vertexGroups = vertices.map(groupBy(_.filter(isRelevantVertex(_)), it.to));

  for (let i = 0; i < vertexGroups.length; ++i) {
    const cleanedGroups = {};

    for (const [ to, vertices ] of Object.entries(vertexGroups[i])) {
      cleanedGroups[to] = cleanTokenVertices(
        vertices.map(vertex => String(vertex.orig || vertex.lenient || '')),
        locale,
        isWhitespaceDelimited
      );
    }

    vertexGroups[i] = cleanedGroups;
  }

  let solutions = fromGroupedVertices(
    vertexGroups,
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

  // The token comparison cache could get quite big, so let's clear it.
  compareTokenStrings.clearCache();
  compareTokenStringsCi.clearCache();

  return solutions;
};

/**
 * @param {string[]} sentences A list of sentences.
 * @param {object} metadata The metadata from the corresponding challenge.
 * @returns {{sentence: string, flags: number}[]}
 * The given list of sentences, complemented with flags indicating which syllabaries are used by each sentence.
 */
const applySyllabariesToJapaneseSentences = (sentences, metadata) => {
  return sentences.map(sentence => ({
    sentence,
    flags: getJapaneseSentenceFilterFlags(sentence),
  }));

  // Applying replacements to Japanese sentences is currently disabled, because it is not reliable enough
  // (Duolingo uses the "grader" graph to generate solutions, and it does not seem to include all of them).

  const syllabaries = {
    hiragana: {
      replacements: {},
      flag: SOLUTION_FLAG_HIRAGANA,
    },
    kana: {
      replacements: {},
      flag: SOLUTION_FLAG_KATAKANA,
    },
    romaji: {
      replacements: {},
      flag: SOLUTION_FLAG_ROMAJI,
    }
  };

  const converters = [ identity ];

  const transliterationSets = [
    metadata.word_transliteration,
    metadata.sentence_transliteration,
    ...(isArray(metadata.token_transliterations) ? metadata.token_transliterations : []),
    ...(isArray(metadata.wrong_token_transliterations) ? metadata.wrong_token_transliterations : []),
    ...(isArray(metadata.option_transliterations) ? metadata.option_transliterations : []),
    ...(isArray(metadata.other_option_transliterations) ? metadata.other_option_transliterations : []),
  ].filter(isObject);

  for (const replacements of transliterationSets.flatMap(it?.tokens || [])) {
    if (
      isObject(replacements)
      && isString(replacements.token)
      && isArray(replacements.transliterations)
    ) {
      for (const replacement of replacements.transliterations) {
        if (syllabaries[replacement?.type]) {
          syllabaries[replacement.type].replacements[replacements.token] = replacement.text;
        }
      }
    }
  }

  for (const { replacements } of Object.values(syllabaries)) {
    if (!isEmptyObject(replacements)) {
      converters.push(lift(
        it.replace(
          new RegExp(Object.keys(replacements).join('|'), 'giu'),
          lift(replacements[it] ?? it)
        )
      ));
    }
  }

  return dedupeBy(
    sentences.flatMap(sentence => converters.map(it(sentence))),
    () => -1,
  ).map(sentence => ({
    sentence,
    flags: getJapaneseSentenceFilterFlags(sentence),
  }));
};

/**
 * @param {string[]} translations A list of base translations.
 * @param {object} metadata The metadata from the corresponding challenge.
 * @param {string} locale The locale of the translations.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromCompactTranslations = (translations, metadata, locale) => {
  const patternSet = {
    locale,
    patterns: [],
  };

  const hasWhitespaces = hasLocaleWordBasedTokens(locale);

  let preparedTranslations;

  if ('ja' === locale) {
    preparedTranslations = applySyllabariesToJapaneseSentences(
      translations.map(it.normalize('NFC')),
      metadata
    );
  } else {
    preparedTranslations = translations.map({
      sentence: it.normalize('NFC'),
      flags: 0,
    });
  }

  const splitTokens = !hasWhitespaces
    ? [ it ]
    : it.split(/([^\p{L}\p{N}]+)/u);

  const prepareTokens = splitTokens(_).filter('' !== it);

  for (const { sentence, flags } of preparedTranslations) {
    let index = 0;
    const branchSets = [];
    const sharedTokens = [];

    const choiceSets = sentence.matchAll(
      !hasWhitespaces
        ? /\[([^\]]+)\]/ug
        : /([^\s[]*\[[^[]+\][^\s[]*)+/ug
    );

    for (const choiceSet of choiceSets) {
      if (choiceSet.index > index) {
        const common = sentence.substring(index, choiceSet.index);

        if ('' !== common) {
          const tokens = prepareTokens(common);
          sharedTokens.push(...tokens);
        }
      }

      let choices;

      const isNewSentence = hasWhitespaces && (
        (sharedTokens.length === 0)
        || !!sharedTokens.at(-1).match(/\p{Sentence_Terminal}\s*$/ug)
      );

      if (hasWhitespaces) {
        // Build all full choices (that may be made up of smaller parts).
        choices = [ '' ];
        let subIndex = 0;
        const subsets = choiceSet[0].matchAll(/\[([^[]+)]/g);

        for (const subset of subsets) {
          if (subset.index > subIndex) {
            const common = choiceSet[0].substring(subIndex, subset.index);
            choices = choices.map(it + common);
          }

          const subChoices = subset[1].split(/\//);
          choices = subChoices.flatMap(sub => choices.map(it + sub));
          subIndex = subset.index + subset[0].length;
        }

        if (subIndex < choiceSet[0].length) {
          const [ , common, punctuation ] = choiceSet[0].substring(subIndex).match(/(.*?)([^\p{L}\p{N}]*)$/u);
          choices = choices.map(it + common);

          if (punctuation.length > 0) {
            // Avoid adding end punctuation to all choices.
            choiceSet[0] = choiceSet[0].slice(0, -punctuation.length);
          }
        }

        choices.sort(compareStringsCi(_, _, locale));
        choices = groupBy(choices.map(prepareTokens), it.length);
      } else {
        choices = groupBy(choiceSet[1].split(/\//).map(prepareTokens), it.length);
      }

      const branches = [];

      // Attempt to reduce the final number of solutions by grouping the choices that share all but 1 or 2 tokens.
      const choiceEntries = Object.entries(choices);

      for (const [ lengthKey, subChoices ] of choiceEntries) {
        const length = Number(lengthKey);

        if (length > 1) {
          const choiceKeys = Array.from(subChoices.keys());

          // Keys to choices where only the first token varies.
          const sameSuffixGroups = Object.values(
            groupBy(choiceKeys, it => subChoices[it].slice(1).join(''))
          ).filter(it => it.length > 1);

          // Keys to choices where only the last token varies.
          const samePrefixGroups = Object.values(
            groupBy(choiceKeys, it => subChoices[it].slice(0, -1).join(''))
          ).filter(it => it.length > 1);

          const handledChoiceKeys = new Set();

          /**
           * Attempt to group choices that share the same infix,
           * and with which every combination of prefix and suffix is represented.
           *
           * This is useful for cases like: "[diesen Karton/den Karton/diesen Kasten/den Kasten]"
           * that can be further optimized to: "[diesen/den] [Karton/Kasten]"
           * instead of just: "[diesen/den] Karton" + "[diesen/den] Kasten".
           */
          if (hasWhitespaces && (length >= 3)) {
            const sameInfixGroups = Object.values(
              groupBy(choiceKeys, it => subChoices[it].slice(1, -1).join(''))
            ).filter(it => it.length > 1);

            for (const sameInfixGroup of sameInfixGroups) {
              const sameInfixSameSuffixGroups = Object.values(
                groupBy(sameInfixGroup, it => subChoices[it].slice(1).join(''))
              ).filter(it => it.length > 1);

              const sameSuffixPrefixes = sameInfixSameSuffixGroups.map(
                it.map(subChoices[it][1].match(/\s/) && subChoices[it][0]).filter(Boolean)
              );

              const sameAffixesGroups = Object.values(
                groupBy(Array.from(sameSuffixPrefixes.keys()), sameSuffixPrefixes[it].join('/'))
              ).filter(it.length > 1);

              for (const keys of sameAffixesGroups) {
                branches.push({
                  sharedTokens: subChoices[sameSuffixGroups[keys[0]][0]].slice(1, -1),
                  firstChoice: sameSuffixGroups[keys[0]].map(subChoices[it][0]),
                  lastChoice: keys.map(subChoices[sameSuffixGroups[it][0]].at(-1)),
                });

                keys.flatMap(sameSuffixGroups[it]).forEach(handledChoiceKeys.add(_));
              }
            }
          }

          // We prioritize grouping on suffixes over grouping on prefixes. This is an arbitrary choice,
          // there is no further optimization to be done w.r.t. to the resulting number of solutions.
          for (let keys of sameSuffixGroups) {
            keys = keys.filter(!handledChoiceKeys.has(_));

            if (keys.length > 1) {
              const choiceTokens = keys.map(subChoices[it][0]).sort(compareStringsCi(_, _, locale));

              branches.push({
                sharedTokens: subChoices[keys[0]].slice(1),
                firstChoice: choiceTokens,
                lastChoice: [],
              });

              keys.forEach(handledChoiceKeys.add(_));
            }
          }

          for (let keys of samePrefixGroups) {
            keys = keys.filter(!handledChoiceKeys.has(_));

            if (keys.length > 1) {
              const choiceTokens = keys.map(subChoices[it].at(-1)).sort(compareStringsCi(_, _, locale));

              branches.push({
                sharedTokens: subChoices[keys[0]].slice(0, -1),
                firstChoice: [],
                lastChoice: choiceTokens,
              });

              keys.forEach(handledChoiceKeys.add(_));
            }
          }

          for (const key of choiceKeys) {
            if (!handledChoiceKeys.has(key)) {
              branches.push({
                sharedTokens: subChoices[key],
                firstChoice: [],
                lastChoice: [],
              });
            }
          }
        } else {
          /**
           * When there is an empty choice at the start of a sentence,
           * the sentence in the corresponding solutions will actually start on the first next non-space token.
           * Remember to adapt the capitalization of the corresponding token,
           * if it seems preferable given the capitalization of the other non-empty choices.
           */
          const shouldTitleCaseNextNonSpaceToken = (
            isNewSentence
            && (length === 0)
            && choiceEntries.every((it[0] === lengthKey) || it[1].some(it[0]?.match(/^\s*[\p{N}\p{Lu}]/ug)))
          );

          branches.push({
            sharedTokens: [],
            firstChoice: subChoices.flat(),
            lastChoice: [],
            shouldTitleCaseNextNonSpaceToken,
          });
        }
      }

      branchSets.push({
        branches,
        tokenPosition: sharedTokens.length,
      });

      index = choiceSet.index + choiceSet[0].length;
    }

    if (index < sentence.length) {
      const common = sentence.substring(index);
      const tokens = prepareTokens(common);
      sharedTokens.push(...tokens);
    }

    let size = 1;

    for (let i = branchSets.length - 1; i >= 0; i--) {
      branchSets[i].branchSize = size;
      size = branchSets[i].branches.length * size;

      for (const branch of branchSets[i].branches) {
        if (1 === branch.firstChoice.length) {
          branch.sharedTokens.unshift(branch.firstChoice.pop());
        }

        if (1 === branch.lastChoice.length) {
          branch.sharedTokens.push(branch.lastChoice.pop());
        }
      }
    }

    patternSet.patterns.push({
      flags,
      size,
      branchSets,
      sharedTokens,
    });
  }

  patternSet.size = patternSet.patterns.reduce(lift(_ + _.size), 0);

  // Generating solutions one by one seems to actually be quite efficient.
  const solutions = [];

  for (let i = 0; i < patternSet.size; i++) {
    solutions.push(getPatternSetSolution(patternSet, i));
  }

    // The token comparison cache could get quite big, so let's clear it.
    compareTokenStringsCi.clearCache();

  return solutions;
};

/**
 * @param {string[]} sentences A list of sentences.
 * @param {object} metadata The metadata from the corresponding challenge.
 * @param {string} locale The locale of the sentences.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromSentences = (sentences, metadata, locale) => {
  let preparedSentences = sentences
    .filter(isString)
    .map(it.trim())
    .filter('' !== it)
    .map(normalizeString);

  if ('ja' === locale) {
    preparedSentences = applySyllabariesToJapaneseSentences(
      preparedSentences,
      metadata
    );
  } else {
    preparedSentences = preparedSentences.map(sentence => ({
      sentence,
      flags: 0,
    }));
  }

  return preparedSentences.map(({ sentence, flags }) => {
    const reference = normalizeString(sentence);
    const tokens = reference.split(/([\p{L}\p{N}]+)/ug).map([ it ]);

    return {
      locale,
      reference,
      tokens,
      flags,
      isComplex: false,
    };
  });
};

/**
 * @param {string[]} wordTokens A list of correct tokens from a word bank.
 * @param {object} metadata The metadata from the corresponding challenge.
 * @param {string} locale The locale of the words.
 * @returns {Solution[]} The corresponding set of solutions.
 */
export const fromWordBankTokens = (wordTokens, metadata, locale) => (
  fromSentences(wordTokens.filter(isString).join(' '), metadata, locale)
);

/**
 * @param {Pattern} pattern A pattern for generating solutions.
 * @param {number} solutionIx The index of the solution to generate.
 * @param {string} locale The locale of the solutions generated by the pattern.
 * @returns {Solution} The generated solution.
 */
const getPatternSolution = (pattern, solutionIx, locale) => {
  const tokens = [];
  let position = 0;
  let reference = '';
  let isComplex = false;
  let shouldTitleCaseNextNonSpaceToken = false;

  const appendTokenToResult = token => {
    if (isArray(token)) {
      if (shouldTitleCaseNextNonSpaceToken) {
        // No need to check for whitespace here - choices can not be only made up of whitespace.
        shouldTitleCaseNextNonSpaceToken = false;
        token = token.map(it.replace(/[\p{L}\p{N}]/u, it.toLocaleUpperCase(locale)));
      }

      tokens.push(token);
      reference += token[0];
    } else {
      if (shouldTitleCaseNextNonSpaceToken && (token.trim() !== '')) {
        shouldTitleCaseNextNonSpaceToken = false;
        token = token.replace(/[\p{L}\p{N}]/u, it.toLocaleUpperCase(locale));
      }

      reference += token;
      tokens.push([ token ]);
    }
  };

  for (const branchSet of pattern.branchSets) {
    for (let i = position; i < branchSet.tokenPosition; i++) {
      appendTokenToResult(pattern.sharedTokens[i]);
    }

    const branch = branchSet.branches[Math.floor(solutionIx / branchSet.branchSize)];

    if (branch.firstChoice.length > 0) {
      isComplex = true;
      appendTokenToResult(branch.firstChoice.sort(compareTokenStringsCi))
    }

    if (branch.sharedTokens.length > 0) {
      for (const token of branch.sharedTokens) {
        appendTokenToResult(token);
      }
    }

    if (branch.lastChoice.length > 0) {
      isComplex = true;
      appendTokenToResult(branch.lastChoice.sort(compareTokenStringsCi));
    }

    position = branchSet.tokenPosition;
    solutionIx = solutionIx % branchSet.branchSize;
    shouldTitleCaseNextNonSpaceToken = shouldTitleCaseNextNonSpaceToken || !!branch.shouldTitleCaseNextNonSpaceToken;
  }

  for (let i = position; i < pattern.sharedTokens.length; i++) {
    appendTokenToResult(pattern.sharedTokens[i]);
  }

  return {
    locale,
    reference,
    tokens,
    isComplex,
    flags: pattern.flags,
  };
};

/**
 * @param {PatternSet} patternSet A set of patterns for generating solutions.
 * @param {number} solutionIx The index of the solution to generate.
 * @returns {Solution|null} The generated solution, or null if the index is out of bounds.
 */
export const getPatternSetSolution = (patternSet, solutionIx) => {
  for (const pattern of patternSet.patterns) {
    if (solutionIx >= pattern.size) {
      solutionIx -= pattern.size;
    } else {
      return getPatternSolution(
        pattern,
        solutionIx,
        patternSet.locale
      );
    }
  }

  return null;
};

/**
 * The (unique) key under which to consolidate reader-friendly strings on a solution.
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
 * The (unique) key under which to consolidate collapsed tokens on a solution.
 * @type {symbol}
 */
const KEY_COLLAPSED_TOKENS = Symbol('collapsed_tokens');

/**
 * @param {Solution} solution A solution.
 * @returns {(string|string[])[]} A list of tokens summarizing all the variations of the given solution.
 */
export const getCollapsedTokens = solution => {
  if (!solution[KEY_COLLAPSED_TOKENS]) {
    const collapsedTokens = [];

    for (let token of solution.tokens) {
      if (token.length > 1) {
        collapsedTokens.push(token);
      } else if (
        (collapsedTokens.length === 0)
        || isArray(collapsedTokens[collapsedTokens.length - 1])
      ) {
        collapsedTokens.push(token[0]);
      } else {
        collapsedTokens[collapsedTokens.length - 1] += token[0];
      }
    }

    solution[KEY_COLLAPSED_TOKENS] = collapsedTokens;
  }

  return solution[KEY_COLLAPSED_TOKENS];
};

/**
 * @param {Solution} solution A solution.
 * @param {object} choiceTokens The set of tokens to use for formatting choices.
 * @param {*} choiceTokens.choiceSeparator The separator to use between each choice in a set of choices.
 * @param {*} choiceTokens.choiceLeftDelimiter The delimiter to use at the start of each set of choices.
 * @param {*} choiceTokens.choiceRightDelimiter The delimiter to use at the end of each set of choices.
 * @returns {Array} A reader-friendly list of tokens summarizing all the variations of the given solution.
 */
export const getReaderFriendlySummaryTokens =
  (
    solution,
    {
      choiceSeparator = ' / ',
      choiceLeftDelimiter = '[',
      choiceRightDelimiter = ']',
    }
  ) => (
    getCollapsedTokens(solution)
      .flatMap(token => (
        !isArray(token)
          ? token
          : [
            choiceLeftDelimiter,
            ...token.flatMap([ it, choiceSeparator ]).slice(0, -1),
            choiceRightDelimiter,
          ]
      ))
  );

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
  let result = compareStringsCi(x.reference, y.reference, x.locale);

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
 * @type {object}
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
