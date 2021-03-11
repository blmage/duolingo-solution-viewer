import { _ } from 'param.macro';
import { EXTENSION_CODE } from './constants';

/**
 * A function that does nothing.
 *
 * @type {Function}
 * @returns {void}
 */
export const noop = () => {
};

/**
 * @type {Function}
 * @param {*} value A value.
 * @returns {*} The same value.
 */
export const identity = _;

/**
 * @type {Function}
 * @param {Promise} promise A promise to run solely for its effects, ignoring its result.
 * @returns {void}
 */
export const runPromiseForEffects = promise => {
  promise.then(noop).catch(noop);
}

/**
 * @type {Function}
 * @param {*} value A value.
 * @returns {boolean} Whether the given value is a valid, finite number.
 */
export const isNumber = value => (typeof value === 'number') && Number.isFinite(value);

/**
 * @type {Function}
 * @param {*} value A value.
 * @returns {boolean} Whether the given value is a string.
 */
export const isString = (typeof _ === 'string');

/**
 * @type {Function}
 * @param {*} value The tested value.
 * @returns {boolean} Whether the given value is an array.
 */
export const isArray = Array.isArray;

/**
 * @type {Function}
 * @param {*} value The tested value.
 * @returns {boolean} Whether the given value is an object. This excludes Arrays, but not Dates or RegExps.
 */
export const isObject = value => ('object' === typeof value) && !!value && !isArray(value);

/**
 * @param {object} object A Plain Old Javascript Object.
 * @returns {boolean} Whether the given object is empty.
 */
export function isEmptyObject(object) {
  for (let key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {*} value The tested value.
 * @returns {boolean} Whether the given value is a blob.
 */
export function isBlob(value) {
  return (value instanceof Blob) || (Object.prototype.toString.call(value) === '[object Blob]');
}

/**
 * @type {Function}
 * @param {*} x A value.
 * @param {*} y Another value.
 * @returns {boolean} Whether the first value is larger than the second.
 */
const gt = (_ > _);

/**
 * @type {Function}
 * @param {*} x A value.
 * @param {*} y Another value.
 * @returns {boolean} Whether the first value is smaller than the second.
 */
const lt = (_ < _);

/**
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to compare.
 * @param {Function} comparer A function usable to compare any two calculated values, and determine which one to keep.
 * @returns {*|undefined} The value in the list whose corresponding calculated value was selected.
 */
export function extremumBy(values, getter, comparer) {
  let selected;
  let extremum;

  if (isArray(values)) {
    for (let i = 0, l = values.length; i < l; i++) {
      const calculated = getter(values[i]);

      if ((undefined === extremum) || comparer(calculated, extremum)) {
        selected = values[i];
        extremum = calculated;
      }
    }
  }

  return selected;
}

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to compare.
 * @returns {*|undefined} The value in the list whose corresponding calculated value is the largest.
 */
export const maxBy = extremumBy(_, _, gt);

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to compare and return.
 * @returns {*|undefined} The largest calculated value from the values in the list.
 */
export const maxOf = (values, getter) => {
  const value = maxBy(values, getter);
  return (undefined === value) ? value : getter(value);
}

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @returns {*|undefined} The largest value in the list.
 */
export const max = maxOf(_, identity);

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to compare.
 * @returns {*|undefined} The value in the list whose corresponding calculated value is the smallest.
 */
export const minBy = extremumBy(_, _, lt);

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to compare and return.
 * @returns {*|undefined} The smallest calculated value from the values in the list.
 */
export const minOf = (values, getter) => {
  const value = minOf(values, getter);
  return (undefined === value) ? value : getter(value);
}

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @returns {*|undefined} The smallest value in the list.
 */
export const min = minOf(_, identity);

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values to be summed up.
 * @returns {number} The sum of the calculated values from the values in the list.
 */
export const sumOf = (values, getter) => values.reduce((result, value) => result + getter(value), 0);

/**
 * @type {Function}
 * @param {number[]} values A list of numbers.
 * @returns {number} The sum of the numbers in the list.
 */
export const sum = sumOf(_, identity);

/**
 * @param {Array} values A list of values.
 * @param {Function} getter A getter for the calculated values on which to group the values in the list.
 * @returns {Object<string, Array>} An object from calculated values to the corresponding subset of original values.
 */
export function groupBy(values, getter) {
  const result = {};

  for (let i = 0, l = values.length; i < l; i++) {
    const value = values[i];
    const key = String(getter(value));

    if (!(key in result)) {
      result[key] = [];
    }

    result[key].push(values[i])
  }

  return result;
}

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @param {Function} choose
 * A function that will be applied to adjacent values whose calculated value is strictly equal.
 * Should return:
 * - -1 to keep only the left value,
 * -  0 to keep both values,
 * - +1 to keep only the right value.
 * @param {Function} map
 * A function that will be applied to the values before comparing them for strict equality.
 * @returns {Array} The given list of values, in which equivalent adjacent values have been deduplicated.
 */
export function dedupeAdjacentBy(values, choose, map = identity) {
  if (values.length <= 1) {
    return values.slice();
  }

  const result = [];
  let baseIndex = 0;
  let left = map(values[0]);

  for (let i = 1, l = values.length; i < l; i++) {
    const right = map(values[i]);

    const choice = (left !== right)
      ? 0
      : choose(values[baseIndex], values[i], left);

    if (-1 !== choice) {
      if (0 === choice) {
        result.push(values[baseIndex]);
      }

      left = right;
      baseIndex = i;
    }
  }

  result.push(values[baseIndex]);

  return result;
}

/**
 * @type {Function}
 * @param {Array} values A list of values.
 * @returns {Array} The given list of values, in which equal adjacent values have been deduplicated.
 */
export const dedupeAdjacent = dedupeAdjacentBy(_, () => -1);

/**
 * @type {Function}
 * @param {Array[]} xss A list of arrays.
 * @returns {Array[]} The cartesian product of the given arrays.
 */
export const cartesianProduct = xss => (0 === xss.length)
  ? []
  : xss.reduce((yss, xs) => yss.flatMap(ys => xs.map(x => [ ...ys, x ])), [ [] ]);


/**
 * @param {Function} compare A comparison function.
 * @returns {Function} The inverse of the given comparison function.
 */
export function invertComparison(compare) {
  return (x, y) => {
    const result = compare(x, y);
    return (result < 0) ? 1 : ((result > 0) ? -1 : 0);
  };
}

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
 *
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
 * @param {Function} mergeValues A function usable to merge two values.
 * @param {Map[]} maps A list of maps.
 * @returns {Map}
 * A new map that contains all the keys of the given maps.
 * If a key occurs in two or more maps, the given function will be used to merge the corresponding values.
 */
export function mergeMapsWith(mergeValues, ...maps) {
  const result = new Map();
  const [ base, ...additional ] = maps;

  for (const [ key, value ] of base) {
    result.set(key, value);
  }

  for (const map of additional) {
    for (const [ key, value ] of map) {
      const existing = result.get(key);
      result.set(key, existing === undefined ? value : mergeValues(existing, value));
    }
  }

  return result;
}

/**
 * @param {string[]} selectors A list of selectors.
 * @returns {Element|null} The first element to match any of the selectors, tested in order.
 */
export function querySelectors(selectors) {
  for (let i = 0, l = selectors.length; i < l; i++) {
    const element = document.querySelector(selectors[i]);

    if (element instanceof Element) {
      return element;
    }
  }

  return null;
}

/**
 * The counter underlying the generation of unique element IDs.
 *
 * @type {number}
 */
let uniqueIdCounter = 1;

/**
 * @param {string} prefix The prefix to prepend to the generated ID.
 * @returns {string} A unique / unused element ID.
 */
export function getUniqueElementId(prefix) {
  let elementId;

  do {
    elementId = prefix + uniqueIdCounter++;
  } while (document.getElementById(elementId));

  return elementId;
}

/**
 * @param {Element} element The element to toggle.
 * @param {boolean|null} displayed The state of the element, if it should be forced.
 */
export function toggleElementDisplay(element, displayed = null) {
  if (element instanceof Element) {
    if (element.style.display === 'none') {
      if (false !== displayed) {
        element.style.display = '';
      }
    } else if (true !== displayed) {
      element.style.display = 'none';
    }
  }
}

/**
 * @param {Event} event The UI event to discard.
 */
export function discardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * @returns {boolean} Whether the currently focused element (if any) is an input.
 */
export function isAnyInputFocused() {
  return !document.activeElement
    ? false
    : [ 'input', 'select', 'textarea' ].indexOf(document.activeElement.tagName.toLowerCase()) >= 0;
}

/**
 * @param {Element} element An element.
 * @param {Element} ancestor An ancestor of the element.
 * @returns {{x: number, y: number}} The offset of the element in its ancestor.
 */
export function getOffsetInAncestor(element, ancestor) {
  let x = 0;
  let y = 0;

  if (ancestor.contains(element)) {
    let parent = element.offsetParent;

    while (parent) {
      x += element.offsetLeft;
      y += element.offsetTop;
      element = parent;
      parent = parent.offsetParent;

      if (!ancestor.contains(parent)) {
        break;
      }
    }
  }

  return { x, y };
}

/**
 * @param {Element} element An element.
 * @param {number} threshold The minimum vertical scrolling height.
 * @returns {Element|null} The first ancestor (if any) of the given element that has a matching vertical scrollbar.
 */
export function getAncestorWithVerticalScrollbar(element, threshold = 10) {
  let ancestor = element.parentElement;

  while (ancestor) {
    if (
      (ancestor.clientHeight > 0)
      && (ancestor.scrollHeight - threshold > ancestor.clientHeight)
      && ([ 'hidden', 'visible' ].indexOf(window.getComputedStyle(ancestor).overflowY) === -1)
    ) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  return null;
}

/**
 * Scrolls an element to the top of its first scrollable ancestor, if it is not entirely visible already.
 *
 * This function does not ensure that the element is actually visible in the current viewport.
 *
 * @param {Element} element An element.
 * @param {number} margin The margin to preserve between the top of the parent and the element itself.
 * @param {string} behavior The scroll behavior ("auto" or "smooth").
 */
export function scrollElementIntoParentView(element, margin = 0, behavior = 'auto') {
  const ancestor = getAncestorWithVerticalScrollbar(element);

  if (!ancestor) {
    return;
  }

  const offset = getOffsetInAncestor(element, ancestor).y;

  if (
    (offset < ancestor.scrollTop + margin)
    || (offset + element.clientHeight > ancestor.scrollTop + ancestor.offsetHeight)
  ) {
    ancestor.scrollTo({ top: offset - margin, behavior });
  }
}

/**
 * @param {Element} element An element.
 * @returns {boolean} Whether the given element is scrollable.
 */
function isScrollableElement(element) {
  try {
    const { overflow, overflowX, overflowY } = getComputedStyle(element);
    return /(auto|scroll)/i.test(overflow + overflowX + overflowY);
  } catch (error) {
    return false;
  }
}

/**
 * @param {Element} element An element.
 * @returns {Node[]} The ancestors of the given element that are scrollable.
 */
export function getScrollableAncestors(element) {
  let parent = element.parentElement;
  const scrollableParents = [ document ];

  while (parent && (parent !== document.body)) {
    isScrollableElement(parent) && scrollableParents.push(parent);
    parent = parent.parentElement;
  }

  return scrollableParents;
}

/**
 * @param {Element} element A fixed element.
 * @returns {Element|null} The parent of the element which has an effect on its position, if any.
 */
export function getFixedElementPositioningParent(element) {
  let parent = element.parentElement;

  while (parent && (parent !== document.body)) {
    const styles = window.getComputedStyle(parent);

    if (styles.getPropertyValue('transform') !== 'none') {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

/**
 * The iframe element used to access working logging functions.
 *
 * @type {HTMLIFrameElement|null}
 */
let loggingIframe = null;

/**
 * @param {*} error The extension-related error to log to the console.
 * @param {?string} prefix A prefix to prepend to the error.
 */
export function logError(error, prefix) {
  if (process.env.NODE_ENV === 'development') {
    if (!loggingIframe || !loggingIframe.isConnected) {
      loggingIframe = document.createElement('iframe');
      loggingIframe.style.display = 'none';
      document.body.appendChild(loggingIframe);
    }

    loggingIframe.contentWindow.console.error(`[${EXTENSION_CODE}] ${prefix || ''}`, error);
  }
}
