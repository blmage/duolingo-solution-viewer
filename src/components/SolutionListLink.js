import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import moize from 'moize';
import { it } from 'param.macro';
import { BASE, BaseComponent } from './BaseComponent';
import { RESULT_CORRECT, RESULT_INCORRECT, DEFAULT_RESULT_COLORS } from '../constants';
import * as solution from '../functions';
import { discardEvent, getSentenceIconUrl, getStylesByClassNames } from '../functions';

const WRAPPER = 'wrapper';
const ICON = 'icon';
const TITLE = 'title';

const CLASS_NAMES = {
  [WRAPPER]: {
    [BASE]: ['_2KzUW'],
    [RESULT_CORRECT]: ['_11OI0'],
    [RESULT_INCORRECT]: ['_1uM9m']
  },
  [ICON]: {
    [BASE]: ['_2wZWI'],
    [RESULT_CORRECT]: ['_1vlYi'],
    [RESULT_INCORRECT]: ['_1uM9m']
  },
  [TITLE]: {
    [BASE]: ['_1kYcS', '_1BWZU']
  }
};

/**
 * Returns the applicable stylesheet for a given result type.
 * @function
 * @param {Symbol} result
 * @returns {Object}
 */
const getResultStyleSheet = moize(
  (result) => {
    const iconStyles = getStylesByClassNames(
      CLASS_NAMES[ICON][BASE].concat(CLASS_NAMES[ICON][result] || []),
      [
        'background-image',
        'background-origin',
        'background-position',
        'background-repeat',
        'background-size',
      ]
    );

    const wrapperStyles = getStylesByClassNames(
      CLASS_NAMES[WRAPPER][BASE].concat(CLASS_NAMES[WRAPPER][result] || []),
      ['color']
    );

    return StyleSheet.create({
      [ICON]: {
        backgroundColor: wrapperStyles['color'] || DEFAULT_RESULT_COLORS[result] || '',
        maskImage: getSentenceIconUrl() || '',
        maskOrigin: iconStyles['background-origin'],
        maskPosition: iconStyles['background-position'],
        maskRepeat: iconStyles['background-repeat'],
        maskSize: iconStyles['background-size'],
      }
    });
  }
);

/**
 * A component for displaying a link to a list of solutions.
 */
export default class SolutionListLink extends BaseComponent {
  getComponentStateKey() {
    return this.props.result || RESULT_CORRECT;
  }

  getAllElementClassNames() {
    return CLASS_NAMES;
  }

  getAllElementStyles() {
    return getResultStyleSheet(this.getComponentStateKey());
  }

  render({ solutions = [], onClick = discardEvent }) {
    if (0 === solutions.length) {
      return null;
    }

    const baseCounts = solution.getI18nCounts(solutions.filter(!it.isAutomatic));

    return (
      <IntlProvider scope="solution.list.link">
        <a className={this.getElementClassNames(WRAPPER)} onClick={onClick}>
          <div className={this.getElementClassNames(ICON)}/>
          <span className={this.getElementClassNames(TITLE)}>
            <Text id="solutions" plural={baseCounts.plural} fields={{ count: baseCounts.display }}>
              Solutions ({baseCounts.display})
            </Text>
          </span>
        </a>
      </IntlProvider>
    );
  }
}
