import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import moize from 'moize';
import { BASE, useStyles } from './base';
import { RESULT_CORRECT, RESULT_INCORRECT, DEFAULT_RESULT_COLORS } from '../constants';
import { discardEvent, getSolutionIconCssUrl, getStylesByClassNames } from '../functions';
import * as solution from '../functions';

const WRAPPER = 'wrapper';
const ICON = 'icon';
const TITLE = 'title';

const CLASS_NAMES = {
  [BASE]: {
    [WRAPPER]: [ '_2KzUW' ],
    [ICON]: [ '_2wZWI' ],
    [TITLE]: [ '_1kYcS', '_1BWZU' ]
  },
  [RESULT_CORRECT]: {
    [WRAPPER]: [ '_11OI0' ],
    [ICON]: [ '_1vlYi' ],
  },
  [RESULT_INCORRECT]: {
    [WRAPPER]: [ '_1uM9m' ],
    [ICON]: [ '_1uM9m' ],
  },
};

/**
 * Returns the applicable stylesheet for a given result type.
 * @function
 * @param {Symbol} result
 * @returns {Object}
 */
const getResultStyleSheet = moize(
  result => {
    const iconStyles = getStylesByClassNames(
      CLASS_NAMES[BASE][ICON].concat(CLASS_NAMES[result][ICON] || []),
      [
        'background-image',
        'background-origin',
        'background-position',
        'background-repeat',
        'background-size',
      ]
    );

    const wrapperStyles = getStylesByClassNames(
      CLASS_NAMES[BASE][WRAPPER].concat(CLASS_NAMES[result][WRAPPER] || []),
      [ 'color' ]
    );

    return StyleSheet.create({
      [ICON]: {
        backgroundColor: wrapperStyles['color'] || DEFAULT_RESULT_COLORS[result] || '',
        maskImage: getSolutionIconCssUrl() || '',
        maskOrigin: iconStyles['background-origin'],
        maskPosition: iconStyles['background-position'],
        maskRepeat: iconStyles['background-repeat'],
        maskSize: iconStyles['background-size'],
      }
    });
  }
);

const SolutionListLink = ({ solutions = [], result = RESULT_CORRECT, onClick = discardEvent }) => {
  if (0 === solutions.length) {
    return null;
  }

  const STYLE_SHEETS = {
    [RESULT_CORRECT]: getResultStyleSheet(RESULT_CORRECT),
    [RESULT_INCORRECT]: getResultStyleSheet(RESULT_INCORRECT),
  };

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ result ]);

  const counts = solution.getI18nCounts(solutions);

  return (
    <IntlProvider scope="solution.list.link">
      <a className={getElementClassNames(WRAPPER)} onClick={onClick}>
        <div className={getElementClassNames(ICON)}/>
        <span className={getElementClassNames(TITLE)}>
            <Text id="solutions" plural={counts.plural} fields={{ count: counts.display }}>
              Solutions ({counts.display})
            </Text>
          </span>
      </a>
    </IntlProvider>
  );
};

export default SolutionListLink;
