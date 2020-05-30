import { useCallback, useEffect } from 'preact/hooks';
import { useLocalStorage as useRawLocalStorage, useStateList } from 'preact-use';
import { css } from 'aphrodite';
import { EXTENSION_PREFIX } from '../constants';

/**
 * The key under which to store the class names and styles of an element that are always applicable, no matter what
 * the current component state is.
 *
 * @type {symbol}
 */
export const BASE = Symbol('base');

/**
 * A hook for getting all the class names of an element based on the current state of a component.
 *
 * @param {object} classNames Some nested maps from state and element keys to class names.
 * @param {object} styleSheets Some nested maps from state and element keys to style sheets.
 * @param {string[]} stateKeys A list of keys describing the current component state.
 * @returns {Function} A function which, given an element key, returns a list of the current corresponding class names.
 */
export const useStyles = (classNames, styleSheets = {}, stateKeys = []) => {
  return useCallback(elementKey => {
    const allClassNames = [];

    if (styleSheets[BASE] && styleSheets[BASE][elementKey]) {
      allClassNames.push(css(styleSheets[BASE][elementKey]));
    }

    if (classNames[BASE] && classNames[BASE][elementKey]) {
      allClassNames.push(...classNames[BASE][elementKey]);
    }

    stateKeys.forEach(stateKey => {
      if (stateKey && styleSheets[stateKey] && styleSheets[stateKey][elementKey]) {
        allClassNames.push(css(styleSheets[stateKey][elementKey]));
      }

      if (stateKey && classNames[stateKey] && classNames[stateKey][elementKey]) {
        allClassNames.push(...classNames[stateKey][elementKey]);
      }
    });

    return allClassNames.join(' ');
  }, stateKeys.concat([ classNames, styleSheets ])); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * A variant of the "useLocalStorage" hook from "react-use" which prepends the extension prefix to the storage keys.
 *
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
 *
 * @param {string} key The base storage key.
 * @param {Array} stateSet The different state values.
 * @param {*} initialValue The initial state value.
 * @returns {{state: *, prevState: *, nextState: *, prev: Function, next: Function}}
 * An object holding the current/previous/next state values, and callbacks for switching to the previous/next state.
 */
export const useLocalStorageList = (key, stateSet, initialValue) => {
  const [ storedState, storeState ] = useLocalStorage(key, initialValue);

  const { state, prevState, nextState, prev, next } = useStateList(
    stateSet,
    (initialValue !== storedState) && (stateSet.indexOf(storedState) === -1)
      ? initialValue
      : storedState
  );

  useEffect(() => storeState(state), [ state, storeState ]);

  return { state, prevState, nextState, prev, next };
};
