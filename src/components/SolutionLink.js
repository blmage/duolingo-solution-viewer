import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import moize from 'moize';
import { CONTEXT_CHALLENGE, CONTEXT_FORUM, useStyles } from './base';
import Loader from './Loader';
import { RESULT_CORRECT, RESULT_INCORRECT, DEFAULT_RESULT_COLORS, RESULT_NONE } from '../constants';

import {
  discardEvent,
  getSolutionsI18nCounts,
  getSolutionIconCssUrl,
  getStylesByClassNames,
} from '../functions';

const SolutionLink =
  ({
     context = CONTEXT_CHALLENGE,
     result = RESULT_NONE,
     isLoading = false,
     solutions = [],
     onClick = discardEvent,
   }) => {
    const STYLE_SHEETS = Object.assign({}, BASE_STYLE_SHEETS, (CONTEXT_FORUM === context)
      ? {}
      : {
        [RESULT_CORRECT]: getChallengeResultStyleSheet(RESULT_CORRECT),
        [RESULT_INCORRECT]: getChallengeResultStyleSheet(RESULT_INCORRECT),
      }
    );

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context, result ]);

    if (!isLoading && (0 === solutions.length)) {
      return null;
    }

    const counts = getSolutionsI18nCounts(solutions);

    const Wrapper = (CONTEXT_CHALLENGE === context) ? 'button' : 'a';

    return (
      <IntlProvider scope="solution_link">
        {isLoading ? (
          <div className={getElementClassNames(WRAPPER)}>
            <Loader />
          </div>
        ) : (
          <Wrapper className={getElementClassNames(WRAPPER)} onClick={onClick}>
            <div className={getElementClassNames(ICON)} />
            <span className={getElementClassNames(TITLE)}>
              <Text id="label" plural={counts.plural} fields={{ count: counts.display }}>
                Solutions ({counts.display})
              </Text>
            </span>
          </Wrapper>
        )}
      </IntlProvider>
    );
  };

export default SolutionLink;

const WRAPPER = 'wrapper';
const ICON = 'icon';
const TITLE = 'title';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links.
    // The class name responsible for the result color is ignored here.
    [WRAPPER]: [ '_3CCt9', '_2kfEr', '_1nlVc', '_2fOC9', 'UCrz7', 't5wFJ' ],
    // Copied from the "Report" and "Discuss" icons.
    // The class name responsible for the background image is ignored here.
    [ICON]: [ '_1eGRT', 'sf9Rc' ],
    // Copied from the "Report" and "Discuss" titles.
    [TITLE]: [ '_28V9T', '_3yAjN' ]
  },
  [CONTEXT_FORUM]: {
    // Copied from the direct wrapper of the "Give Lingot" link.
    [WRAPPER]: [ '_5j_V-' ],
    // Copied from the "Reply" link.
    [TITLE]: [ 'uFNEM', 'tCqcy' ],
  },
  [RESULT_CORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is correct.
    // Adds the "correct" color.
    [WRAPPER]: [ '_3NwXb', '_34Jmg' ],
  },
  [RESULT_INCORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is incorrect.
    // Adds the "incorrect" color.
    [WRAPPER]: [ '_1BszG', '_2tfS2' ],
  },
};

// Copied from the wrapper of the "Report" and "Discuss" icons and links.
// We do not add those class names to the icon elements because we already apply the right colors on them using
// inline styles. Custom themes targeting those class names may also apply their own filters, giving unwanted results.
const ICON_RESULT_CLASS_NAMES = {
  [RESULT_CORRECT]: [ '_3NwXb', '_34Jmg' ],
  [RESULT_INCORRECT]: [ '_1BszG', '_2tfS2' ],
};

const BASE_STYLE_SHEETS = {
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [WRAPPER]: {
      height: '100%',
    },
  }),
  [CONTEXT_FORUM]: StyleSheet.create({
    [WRAPPER]: {
      cursor: 'pointer',
      float: 'right',
      marginRight: '20px',
      userSelect: 'none',
    },
  }),
};

/**
 * @function
 * @param {string} result A result type.
 * @returns {object} The corresponding stylesheet applicable on a challenge page.
 */
const getChallengeResultStyleSheet = moize(
  result => {
    const iconStyles = getStylesByClassNames(
      CLASS_NAMES[CONTEXT_CHALLENGE][ICON].concat(ICON_RESULT_CLASS_NAMES[result] || []),
      [
        'background-origin',
        'background-position',
        'background-repeat',
        'background-size',
        'color',
      ]
    );

    return StyleSheet.create({
      [ICON]: {
        backgroundColor: iconStyles['color'] || DEFAULT_RESULT_COLORS[result] || '',
        maskImage: getSolutionIconCssUrl() || '',
        maskOrigin: iconStyles['background-origin'],
        maskPosition: iconStyles['background-position'],
        maskRepeat: iconStyles['background-repeat'],
        maskSize: iconStyles['background-size'],
      }
    });
  }
);
