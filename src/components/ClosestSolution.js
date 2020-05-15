import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { BASE, BaseComponent } from './BaseComponent';
import { RESULT_CORRECT, RESULT_INCORRECT } from '../constants';

const WRAPPER = 'wrapper';
const VALUE = 'value';

const CLASS_NAMES = {
  [WRAPPER]: {
    [BASE]: ['_36Uyg'],
    [RESULT_CORRECT]: ['_11xjL '],
    [RESULT_INCORRECT]: ['_2QxbX'],
  },
  [VALUE]: {
    [BASE]: ['TnCw3'],
  },
};

const STYLES = StyleSheet.create({
  [WRAPPER]: {
    marginBottom: '10px'
  }
});

/**
 * A component for displaying the closest solution to a user answer.
 */
export default class ClosestSolution extends BaseComponent {
  getComponentStateKey() {
    return this.props.result || RESULT_CORRECT;
  }

  getAllElementClassNames() {
    return CLASS_NAMES;
  }

  getAllElementStyles() {
    return STYLES;
  }

  render({ solution = '' }) {
    if (!solution) {
      return null;
    }

    return (
      <IntlProvider scope="solution.closest">
        <h2 className={this.getElementClassNames(WRAPPER)}>
          <Text id="closest_solution">Closest solution:</Text>
          <div className={this.getElementClassNames(VALUE)}>
            <span>
              <span>{solution}</span>
            </span>
          </div>
        </h2>
      </IntlProvider>
    );
  }
}
