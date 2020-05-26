import { useCallback, useEffect } from 'preact/hooks';
import { useLocalStorage as useRawLocalStorage, useStateList } from 'preact-use';
import { css } from 'aphrodite';
import { isArray } from 'lodash';
import { EXTENSION_PREFIX } from '../constants';

/**
 * The key under which to store the class names and styles of an element that are always applicable, no matter what
 * the current component state is.
 * @type {symbol}
 */
export const BASE = Symbol('base');

/**
 * A hook for getting all the class names of an element based on the current state of a component.
 * @param {Object} classNames
 * @param {Object} styleSheets
 * @param {string[]} stateKeys
 * @returns {function}
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
  }, isArray(stateKeys) ? stateKeys : []);
};

/**
 * A variant of the "useLocalStorage" hook from "react-use" which prepends the extension prefix to the storage keys.
 * @param {string} key
 * @param {*} initialValue
 * @param {Object?} options
 * @returns {[ *, function, function ]}
 */
export const useLocalStorage = (key, initialValue, options) => {
  return useRawLocalStorage(EXTENSION_PREFIX + key, initialValue, options);
};

/**
 * A hook for circularly iterating over an array and storing the current value in the local storage.
 * @param {string} key
 * @param {Array} stateSet
 * @param {*} initial
 * @returns {{ state: *, nextState: *, next: function }}
 */
export const useLocalStorageList = (key, stateSet, initial) => {
  const [ storedState, storeState ] = useLocalStorage(key, initial);

  const { state, nextState, next } = useStateList(
    stateSet,
    (initial !== storedState) && (stateSet.indexOf(storedState) === -1)
      ? initial
      : storedState
  );

  useEffect(() => storeState(state), [ state ]);

  return { state, nextState, next };
};
