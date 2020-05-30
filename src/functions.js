import lodash from 'lodash';
import 'lodash.product';
import moize from 'moize';
import { Map } from 'immutable';

import {
  DEFAULT_LOCALE,
  EXTENSION_CODE,
  EXTENSION_PREFIX,
  IMAGE_CDN_DEFAULT_BASE_URL,
  MENU_ICON_SELECTOR,
  SENTENCE_ICON_CLASS_NAMES,
} from './constants';

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
 * @param {Event} event The UI event to completely discard.
 */
export function discardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * @function
 * @param {string[]} classNames A set of class names.
 * @param {string[]} styleNames The names of the styles whose values should be returned.
 * @returns {object} A subset of the computed style values applied by the given set of class names.
 */
export const getStylesByClassNames = moize(
  (classNames, styleNames) => {
    const element = document.createElement('div');

    element.style.display = 'none';
    classNames.forEach(className => element.classList.add(className));
    document.body.appendChild(element);

    const computedStyle = getComputedStyle(element);
    const styles = lodash.fromPairs(styleNames.map(name => [ name, computedStyle.getPropertyValue(name) || '' ]));

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
    const solutionIconMeta = document.querySelector(`meta[name="${EXTENSION_PREFIX}-solution-icon-url"]`);
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
  return lodash.get(window || {}, [ 'duo', 'uiLanguage' ]) || DEFAULT_LOCALE;
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
 * @param {Function} mutator A function applying a series of mutations to a given map. 
 * @returns {Map} A new map initialized using the given mutator.
 */
export function newMapWith(mutator) {
  return Map().withMutations(mutator);
}

/**
 * @param {Function} merge The function usable to resolve key conflicts.
 * @param {Map} base The base map.
 * @param {Map[]} maps A list of maps to merge into the base map.
 * @returns {Map} The union of all the given maps.
 */
export function mergeMapsWith(merge, base, ...maps) {
  return (maps.length > 0) ? base.mergeWith(merge, ...maps) : base;
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
