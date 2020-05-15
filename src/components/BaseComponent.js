import { Component, h } from 'preact';
import { css } from 'aphrodite';
import lodash from 'lodash';
import { EXTENSION_CODE } from '../constants';

/**
 * The key under which to store the class names of an element that are always applicable, no matter the component state.
 * @type {Symbol}
 */
export const BASE = Symbol('base');

/**
 * A convenient base for the components of the extension, simplifying the reuse of existing UI elements and styles,
 * and providing state persistence.
 */
export class BaseComponent extends Component {
  /**
   * Returns the key under which to store the persistent state of the component.
   * @returns {string}
   */
  getPersistentStateStorageKey() {
    return EXTENSION_CODE + '.' + this.constructor.name + '.state';
  }

  /**
   * Returns the default persistent state of the component.
   * @returns {Object}
   */
  getDefaultPersistentState() {
    return {};
  }

  /**
   * Loads the current persistent state of the component from the localStorage.
   * @returns {Object}
   */
  loadPersistentState() {
    const defaultState = this.getDefaultPersistentState();

    try {
      const storageState = JSON.parse(localStorage.getItem(this.getPersistentStateStorageKey()));

      return lodash.assign(
        {},
        defaultState,
        lodash.pick(storageState || {}, lodash.keys(defaultState))
      );
    } catch (error) {
      return defaultState;
    }
  }

  /**
   * Updates the current state of the component, and saves its persistent subset to the localStorage.
   * @param {Object} state
   */
  saveState(state) {
    this.setState(state, () => {
      const defaultState = this.getDefaultPersistentState();
      const storableState = JSON.stringify(lodash.pick(this.state, lodash.keys(defaultState)));
      localStorage.setItem(this.getPersistentStateStorageKey(), storableState)
    });
  }

  /**
   * Returns the current state key of the component.
   * @returns {string|null}
   */
  getComponentStateKey() {
    return null;
  }

  /**
   * Returns all the available element class names, arranged by element keys then state keys.
   * @returns {Object.<string, Object>}
   */
  getAllElementClassNames() {
    return {};
  }

  /**
   * Returns all the available element styles, arranged by element keys.
   * @returns {Object.<string, Object>}
   */
  getAllElementStyles() {
    return {};
  }

  /**
   * Returns the class names currently applicable to an element.
   * @param {string} elementKey
   * @returns {string}
   */
  getElementClassNames(elementKey) {
    const classNames = this.getAllElementClassNames();
    const styleClassNames = css(this.getAllElementStyles()[elementKey] || []);

    if (classNames[elementKey]) {
      const stateKey = this.getComponentStateKey();
      const baseClassNames = classNames[elementKey][BASE] || [];
      const stateClassNames = stateKey && classNames[elementKey][stateKey] || [];
      return baseClassNames.concat(stateClassNames).join(' ') + ' ' + styleClassNames;
    }

    return styleClassNames;
  }
}
