import moize from 'moize';
import { it } from 'param.macro';
import Cookies from 'js-cookie';

import {
  ACTION_RESULT_SUCCESS,
  DEFAULT_LOCALE, EXTENSION_CODE,
  IMAGE_CDN_DEFAULT_BASE_URL,
  MENU_ICON_SELECTOR,
  MESSAGE_TYPE_ACTION_REQUEST,
  MESSAGE_TYPE_ACTION_RESULT,
  MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
  SENTENCE_ICON_CLASS_NAMES,
  SOLUTION_ICON_URL_META_NAME,
} from './constants';

/**
 * A function which does nothing.
 */
export function noop() {
}

/**
 * @param {Promise} promise A promise to run solely for its effects, ignoring its result.
 */
export function runPromiseForEffects(promise) {
  promise.then(noop).catch(noop);
}

/**
 * @param {*} value The tested value.
 * @returns {boolean} Whether the given value is an object. This excludes Arrays, but not Dates or RegExps.
 */
export function isObject(value) {
  return ('object' === typeof value) && !!value && !Array.isArray(value);
}

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
 * @param {string} string A string.
 * @returns {string} A Unicode-normalized version of the given string, in which redundant spaces have been removed.
 */
export function normalizeString(string) {
  return string.normalize().replace(/(\s)\1+/g, '$1');
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
export function compareStrings(x, y, locale) {
  return x.localeCompare(y, locale, {
    ignorePunctuation: true,
    numeric: true,
    sensitivity: 'accent',
    usage: 'sort',
  });
}

/**
 * @param {string[]} selectors A list of selectors.
 * @returns {Element|null} The first element to match any of the selectors, in order.
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
 * @returns {string} A unique/unused element ID.
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
export function toggleElement(element, displayed = null) {
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
 * @param {Event} event The UI event to completely discard.
 */
export function discardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * @returns {boolean} Whether the currently focused element is an input.
 */
export function isInputFocused() {
  return !document.activeElement
    ? false
    : ([ 'input', 'select', 'textarea' ].indexOf(document.activeElement.tagName.toLowerCase()) >= 0);
}

/**
 * @param {Element} element An element.
 * @returns {Element} The first ancestor of the given element which has a scrollbar.
 */
export function getScrollableAncestor(element) {
  let parent = element.parentNode;

  while (parent) {
    if ((parent.clientHeight > 0) && (parent.scrollHeight > parent.clientHeight)) {
      return parent;
    }

    parent = parent.parentNode;
  }

  return document.body;
}

/**
 * @function
 * @param {string[]} classNames A set of class names.
 * @param {string[]} styleNames The names of the styles whose values should be returned.
 * @returns {object} A subset of the computed style values applied by the given set of class names.
 */
export const getStylesByClassNames = moize(
  (classNames, styleNames) => {
    const styles = {};

    const element = document.createElement('div');
    element.style.display = 'none';
    classNames.forEach(className => element.classList.add(className));

    document.body.appendChild(element);
    const computedStyle = getComputedStyle(element);

    styleNames.forEach(name => {
      styles[name] = computedStyle.getPropertyValue(name) || '';
    });

    element.remove();

    return styles;
  }
);

/**
 * @function
 * @returns {string} The base URL of the image CDN.
 */
export const getImageCdnBaseUrl = moize(
  () => {
    const menuIcon = document.querySelector(MENU_ICON_SELECTOR);
    return `${new URL(menuIcon && menuIcon.src || IMAGE_CDN_DEFAULT_BASE_URL).origin}/`;
  }
);

/**
 * @function
 * @returns {string|null} The CSS URL of the solution icon, if it can be determined.
 */
export const getSolutionIconCssUrl = moize(
  () => {
    const solutionIconMeta = document.querySelector(`meta[name="${SOLUTION_ICON_URL_META_NAME}"]`);
    const solutionIconUrl = (solutionIconMeta && solutionIconMeta.getAttribute('content') || '').trim();

    return (solutionIconUrl && `url(${solutionIconUrl})`)
      || getStylesByClassNames(SENTENCE_ICON_CLASS_NAMES, [ 'background-image' ])['background-image']
      || null;
  }
);

/**
 * @returns {string} The tag of the current language used for the UI.
 */
export function getUiLocale() {
  return String(isObject(window.duo) && window.duo.uiLanguage || '').trim()
    || String(Cookies.get('ui_language') || '').trim()
    || DEFAULT_LOCALE;
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

/**
 * Sends an action request to the content script.
 *
 * @param {string} action The action key.
 * @param {*} value The action payload.
 * @returns {Promise} A promise for the result of the action.
 */
export async function sendActionRequestToContentScript(action, value) {
  return new Promise((resolve, reject) => {
    const resultListener = event => {
      if (
        (event.source === window)
        && event.data
        && (MESSAGE_TYPE_ACTION_RESULT === event.data.type)
        && (action === event.data.action)
      ) {
        if (event.data.result === ACTION_RESULT_SUCCESS) {
          resolve(event.data.value || null);
        } else {
          reject();
        }

        event.stopPropagation();
        window.removeEventListener('message', resultListener);
      }
    };

    window.addEventListener('message', resultListener);

    window.postMessage({
      type: MESSAGE_TYPE_ACTION_REQUEST,
      action,
      value,
    }, '*');
  });
}

/**
 * Sends an event notification to the content script.
 *
 * @param {string} event The event key.
 * @param {*} value The event payload.
 */
export function sendEventNotificationToContentScript(event, value) {
  window.postMessage({
    type: MESSAGE_TYPE_UI_EVENT_NOTIFICATION,
    event,
    value,
  }, '*');
}

// Below are some utility functions that would better be located in 'solutions.js' if the tree-shaking was efficient
// enough (which is not currently the case).

/**
 * @param {import('./solutions.js').Solution} solution A solution.
 * @returns {string} A user-friendly string summarizing the given solution.
 */
export function getSolutionDisplayableString(solution) {
  return solution.tokens.reduce((result, choices) => {
    return result + ((1 === choices.length) ? choices[0] : `[${choices.join(' / ')}]`);
  }, '');
}

/**
 * @param {import('./solutions.js').Solution} x A solution.
 * @param {import('./solutions.js').Solution} y Another solution.
 * @returns {number}
 * The result of the alphabetical comparison between the solution references. A negative value if x comes before y,
 * a positive value if x comes after y, and 0 if both solutions have equivalent references.
 */
export function compareSolutionReferences(x, y) {
  let result = compareStrings(x.reference, y.reference, x.locale);

  if (0 === result) {
    result = y.isComplex - x.isComplex;
  }

  return result;
}

/**
 * @param {import('./solutions.js').Solution} x A solution.
 * @param {import('./solutions.js').Solution} y Another solution.
 * @returns {number}
 * The result of the comparison between the similarity scores of the solutions. A negative value if x comes before y,
 * a positive value if x comes after y, and 0 if both solutions are similar.
 */
export function compareSolutionScores(x, y) {
  const result = (y.score || 0) - (x.score || 0);
  // Note to self: this is the right order.
  return (0 !== result) ? result : compareSolutionReferences(x, y);
}

/**
 * @param {import('./solutions.js').Solution[]} solutions A set of solutions.
 * @returns {{display: string, plural: number}}
 * An object holding a displayable count and a number usable for pluralization.
 */
export function getSolutionsI18nCounts(solutions) {
  let plural = solutions.length;
  let display = plural.toString();

  if (solutions.some(!!it.isComplex)) {
    ++plural;
    display += '+';
  }

  return { display, plural };
}
