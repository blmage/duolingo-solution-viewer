import { _ } from 'one-liner.macro';

/**
 * @param {string} string The string to normalize.
 * @param {boolean} removeExtraSpaces Whether leading / trailing / redundant spaces should be removed.
 * @param {boolean} removeDiacritics Whether diacritics should be removed.
 * @returns {string} The given string, without extra spaces and / or diacritics, and normalized using NFC.
 */
export function normalizeString(string, removeExtraSpaces = true, removeDiacritics = false) {
  let result = !removeDiacritics
    ? string
    : string.normalize('NFD').replace(/\p{M}/ug, '');

  result = result.normalize('NFC');

  return !removeExtraSpaces
    ? result
    : result.trim().replace(/(\s)\1+/g, '$1');
}

/**
 * Compares two strings using a sensible set of collation rules.
 * @param {string} x A string.
 * @param {string} y Another string.
 * @param {string} locale The locale to use for the comparison.
 * @returns {number} -1 if x comes before y, 1 if x comes after y, and 0 if both strings are equal.
 */
export function compareStrings(x, y, locale) {
  return x.localeCompare(y, locale, {
    ignorePunctuation: true,
    numeric: true,
    sensitivity: 'accent',
    usage: 'sort',
  });
}

/**
 * @param {string} string A string.
 * @param {string} substring The substring to search in the given string.
 * @returns {[number, number]} The leftmost and rightmost indices of the given substring in the given string.
 */
export function boundIndicesOf(string, substring) {
  if (string === substring) {
    return [ 0, 0 ];
  }

  if (substring.length >= string.length) {
    return [ -1, -1 ];
  }

  const firstIndex = string.indexOf(substring);

  if ((firstIndex === -1) || (firstIndex + substring.length + 1 > string.length)) {
    return [ firstIndex, firstIndex ];
  }

  return [ firstIndex, string.lastIndexOf(substring) ];
}

/**
 * @param {string} string A string.
 * @returns {string[]} The words (sequences of letters and / or numbers) contained in the given string.
 */
export function getStringWords(string) {
  const words = string.match(/([\p{L}\p{N}]+)/ug);
  return !words ? [] : Array.from(words);
}

/**
 * @type {Function}
 * @param {string} character A character.
 * @returns {boolean} Whether the given character is a letter or a number, in the broad sense.
 */
const isWordCharacter = /[\p{L}\p{N}]/u.test(_);

/**
 *
 * @param {string} string A string.
 * @param {number} position A position in the string.
 * @returns {string} The word that is present in the string at the given position, if any.
 */
export function getWordAt(string, position) {
  if (position > string.length) {
    return '';
  }

  let word = string.substring(position, position + 1);

  if (!isWordCharacter(word)) {
    return '';
  }

  for (let i = position; i > 0; i--) {
    const char = string.slice(i - 1, i);

    if (!isWordCharacter(char)) {
      break;
    }

    word = char + word;
  }

  for (let i = position + 1, l = string.length; i < l; i++) {
    const char = string.slice(i, i + 1);

    if (!isWordCharacter(char)) {
      break;
    }

    word = word + char;
  }

  return word;
}

/**
 * @param {string} word A word.
 * @returns {Map<string, number>} A map from the bigrams of the given word to the corresponding number of occurrences.
 */
export const getWordBigramMap = word => {
  const map = new Map();

  if (word.length <= 2) {
    map.set(word, (map.get(word) || 0) + 1);
  } else {
    for (let i = 0, l = word.length - 1; i < l; i++) {
      const bigram = word.substring(i, i + 2);
      map.set(bigram, (map.get(bigram) || 0) + 1);
    }
  }

  return map;
};
