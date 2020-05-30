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
 * @type {number}
 */
let uniqueIdCounter = 1;

/**
 * Returns a unique/unused element ID based on a prefix.
 * @param {string} prefix
 * @returns {string}
 */
export function getUniqueElementId(prefix) {
  let elementId;

  do {
    elementId = prefix + uniqueIdCounter++;
  } while (document.getElementById(elementId));

  return elementId;
}

/**
 * A convenience function for completely discarding a UI event.
 * @param {Event} event
 */
export function discardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Returns a subset of the computed style values applied by a set of class names.
 * @function
 * @param {string[]} classNames
 * @param {string[]} styleNames
 * @returns {Object}
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
 * Returns the base URL of the image CDN.
 * @function
 */
export const getImageCdnBaseUrl = moize(
  () => {
    const menuIcon = document.querySelector(MENU_ICON_SELECTOR);
    return new URL(menuIcon && menuIcon.src || IMAGE_CDN_DEFAULT_BASE_URL).origin + '/';
  }
);

/**
 * Returns the CSS URL of the solution icon, if it can be determined.
 * @function
 * @returns {string|null}
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
 * Returns the tag of the current language used for the UI.
 * @returns {string}
 */
export function getUiLocale() {
  return lodash.get(window || {}, [ 'duo', 'uiLanguage' ]) || DEFAULT_LOCALE;
}

/**
 * The iframe element used to access working logging functions.
 * @type {HTMLIFrameElement|null}
 */
let loggingIframe = null;

/**
 * Logs an extension-related error to the console.
 * @param {*} error
 * @param {?string} prefix
 */
export function logError(error, prefix) {
  if (process.env.NODE_ENV === 'development') {
    if (!loggingIframe || !loggingIframe.isConnected) {
      loggingIframe = document.createElement('iframe');
      loggingIframe.style.display = 'none';
      document.body.appendChild(loggingIframe);
    }

    loggingIframe.contentWindow.console.error('[' + EXTENSION_CODE + '] ' + (prefix || ''), error);
  }
}

/**
 * Initializes an immutable Map with a series of mutations.
 * @param {Function} mutator
 * @returns {Map}
 */
export function newMapWith(mutator) {
  return Map().withMutations(mutator);
}

/**
 * Merges two or more immutable Maps, using the given function to resolve key conflicts.
 * @param {Function} merge
 * @param {Map} base
 * @param {Map[]} maps
 * @returns {Map}
 */
export function mergeMapsWith(merge, base, ...maps) {
  return (maps.length > 0) ? base.mergeWith(merge, ...maps) : base;
}

/**
 * Inverts a comparison function.
 * @param {function} compare
 * @returns {function}
 */
export function invertComparison(compare) {
  return (x, y) => {
    const result = compare(x, y);
    return (result < 0) ? 1 : ((result > 0) ? -1 : 0);
  };
}
