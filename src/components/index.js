import { useCallback, useEffect, useRef } from 'preact/hooks';
import { createGlobalState, useLocalStorage as useRawLocalStorage, useStateList } from 'preact-use';
import { css } from 'aphrodite';
import { isArray } from 'duo-toolbox/utils/functions';
import { getUniqueElementId } from 'duo-toolbox/utils/ui';
import { EXTENSION_PREFIX, IMAGE_CDN_DEFAULT_BASE_URL } from '../constants';

/**
 * The key under which to store the class names and styles of an element that are always applicable,
 * no matter what the current state / context of the corresponding component is.
 * @type {symbol}
 */
export const BASE = Symbol('base');

/**
 * The key under which to store the class names and styles of an element that are applicable when on a challenge page.
 * @type {symbol}
 */
export const CONTEXT_CHALLENGE = Symbol('challenge');

/**
 * @param {Function} component A functional component.
 * @param {object} forcedProps A set of props to be forced on the component.
 * @returns {Function} The same functional component with the given props forced.
 */
export const withForcedProps = (component, forcedProps) => props => component({ ...props, ...forcedProps });

/**
 * @param {Function} component A functional component.
 * @param {string} context A context.
 * @returns {Function} The same functional component with the given context forced.
 */
export const withContext = (component, context) => withForcedProps(component, { context });

/**
 * A variant of the "useLocalStorage" hook from the "react-use" package,
 * which prepends the extension prefix to the storage keys.
 * @type {Function}
 * @param {string} key The base storage key.
 * @param {*} initialValue The initial state value.
 * @param {?object} options A set of options (see the original function).
 * @returns {[*, Function, Function]} An array holding the current state value, a setter, and a remover.
 */
export const useLocalStorage = (key, initialValue, options) => {
  return useRawLocalStorage(EXTENSION_PREFIX + key, initialValue, options);
};

/**
 * A hook for circularly iterating over an array and storing the current value in the local storage.
 * @param {string} key The base storage key.
 * @param {Array} stateSet The different state values.
 * @param {*} initialValue The initial state value.
 * @returns {{state: *, prevState: *, nextState: *, prev: Function, next: Function}}
 * An object holding the current / previous / next state values,
 * and callbacks for switching to the previous / next state.
 */
export const useLocalStorageList = (key, stateSet, initialValue) => {
  const isInitialized = useRef(false);
  const [ storedState, storeState ] = useLocalStorage(key, initialValue);

  const { state, prevState, nextState, prev, next } = useStateList(
    stateSet,
    !stateSet.includes(storedState) ? initialValue : storedState
  );

  useEffect(() => {
    // Skip the first call to prevent overriding the stored state with a temporary default state.
    if (isInitialized.current) {
      storeState(state)
    } else {
      isInitialized.current = true;
    }
  }, [ state, storeState ]);

  return { state, prevState, nextState, prev, next };
};

/**
 * A hook for globally throttling a callback. The delay is never reset when dependencies change.
 * @param {Function} callback The callback to throttle.
 * @param {number} delay The delay during which any subsequent call will be ignored (in milliseconds).
 * @param {Array} args The arguments to the callback.
 * @returns {Function} The throttled callback.
 */
export const useThrottledCallback = (callback, delay = 200, args) => {
  const timeout = useRef();

  return useCallback(() => {
    if (!timeout.current) {
      callback(...args);
      timeout.current = setTimeout(() => (timeout.current = null), delay);
    }
  }, args.concat(callback, delay)); // eslint-disable-line react-hooks/exhaustive-deps
};

// Use a shared element to wrap portals, created on demand.

const useRawPortalContainer = createGlobalState(() => {
  const container = document.createElement('div');
  container.id = getUniqueElementId(`${EXTENSION_PREFIX}-portal`);
  document.body.appendChild(container);
  return container;
});

/**
 * @returns {Element} A container for components which should be rendered outside the DOM hierarchy of their parents.
 */
export const usePortalContainer = () => useRawPortalContainer()[0];

/**
 * A hook for getting all the class names applicable to an element,
 * based on the current state / context of the component that embeds it.
 * @param {object} classNames Some nested maps from state and element keys to class names.
 * @param {object} styleSheets Some nested maps from state and element keys to style sheets.
 * @param {(string|symbol)[]} stateKeys A list of keys describing the current state / context of the component.
 * @returns {Function} A function which, given one or more element keys, returns a list of the applicable class names.
 */
export const useStyles = (classNames, styleSheets = {}, stateKeys = []) => {
  return useCallback(elementKeys => {
    const keys = isArray(elementKeys) ? elementKeys : [ elementKeys ];

    return keys.flatMap(elementKey => {
      const allClassNames = [];

      if (styleSheets[BASE]?.[elementKey]) {
        allClassNames.push(css(styleSheets[BASE][elementKey]));
      }

      if (classNames[BASE]?.[elementKey]) {
        allClassNames.push(...classNames[BASE][elementKey]);
      }

      stateKeys.forEach(stateKey => {
        if (stateKey) {
          if (styleSheets[stateKey]?.[elementKey]) {
            allClassNames.push(css(styleSheets[stateKey][elementKey]));
          }

          if (classNames[stateKey]?.[elementKey]) {
            allClassNames.push(...classNames[stateKey][elementKey]);
          }
        }
      });

      return allClassNames;
    }).join(' ')
  }, stateKeys.concat([ classNames, styleSheets ])); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * A CSS selector for menu icons.
 * @type {string}
 */
const MENU_ICON_SELECTOR = 'img._1TuHK';

const useImageCdnBaseUrl = createGlobalState(() => {
  const menuIcon = document.querySelector(MENU_ICON_SELECTOR);
  return `${new URL(menuIcon?.src || IMAGE_CDN_DEFAULT_BASE_URL).origin}/`;
});

/**
 * @param {string} path A path on the image CDN.
 * @returns {string} The corresponding URL.
 */
export const useImageCdnUrl = path => `${useImageCdnBaseUrl()[0]}${path}`;
