import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { discardEvent } from 'duo-toolbox/utils/ui';
import { RESULT_CORRECT, RESULT_INCORRECT, RESULT_NONE } from 'duo-toolbox/duo/challenges';
import * as Solution from '../solutions';
import { CONTEXT_CHALLENGE, CONTEXT_FORUM, useStyles } from './index';
import Loader from './Loader';

const SolutionLink =
  ({
     context = CONTEXT_CHALLENGE,
     solutions = [],
     result = RESULT_NONE,
     isLoading = false,
     onClick = discardEvent,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context, result ]);

    if (!isLoading && (0 === solutions.length)) {
      return null;
    }

    const counts = Solution.getI18nCounts(solutions);

    const Button = (CONTEXT_CHALLENGE === context) ? 'button' : 'a';

    return (
      <IntlProvider scope="solution_link">
        {isLoading ? (
          <div className={getElementClassNames(BUTTON)}>
            <Loader />
          </div>
        ) : (
          <Button onClick={onClick} className={getElementClassNames(BUTTON)}>
            <span className={getElementClassNames(BUTTON_CONTENT)}>
              {(CONTEXT_CHALLENGE === context)
              && (
                <FontAwesomeIcon
                  icon={[ 'far', 'key' ]}
                  size={'w-18'}
                  className={getElementClassNames(ICON)}
                />
              )}
              <span className={getElementClassNames(TITLE)}>
                <Text id="label" plural={counts.plural} fields={{ count: counts.display }}>
                  Solutions ({counts.display})
                </Text>
              </span>
            </span>
          </Button>
        )}
      </IntlProvider>
    );
  };

export default SolutionLink;

const BUTTON = 'button';
const BUTTON_CONTENT = 'button_content';
const ICON = 'icon';
const TITLE = 'title';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    // Copied from the "Report" and "Discuss" buttons.
    // The class name responsible for the result color is ignored here.
    [BUTTON]: [ '_3CCt9', '_3HsTU', '_2kfEr', '_1nlVc', '_2fOC9', 'UCrz7', 't5wFJ' ],
    // Copied from the direct wrappers of the "Report" and "Discuss" icons and links.
    [BUTTON_CONTENT]: [ '_1-Ukw' ],
    // Copied from the "Report" and "Discuss" icons.
    // The class name responsible for the background image is ignored here.
    [ICON]: [ '_1eGRT', 'sf9Rc' ],
    // Copied from the "Report" and "Discuss" titles.
    [TITLE]: [ '_28V9T', '_3yAjN' ]
  },
  [CONTEXT_FORUM]: {
    // Copied from the direct wrapper of the "Give Lingot" link.
    [BUTTON]: [ '_5j_V-' ],
    // Copied from the "Reply" link.
    [TITLE]: [ 'uFNEM', 'tCqcy' ],
  },
  [RESULT_CORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is correct.
    // Adds the "correct" color.
    [BUTTON]: [ '_1xOpZ' ],
    // This class is now only defined in Darklingo++, and applies the same color as the other icons.
    [ICON]: [ '_3NwXb' ],
  },
  [RESULT_INCORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is incorrect.
    // Adds the "incorrect" color.
    [BUTTON]: [ 'I5L6p' ],
    // This class is now only defined in Darklingo++, and applies the same color as the other icons.
    [ICON]: [ '_1BszG' ],
  },
};

const STYLE_SHEETS = {
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [BUTTON]: {
      height: '100%',
    },
  }),
  [CONTEXT_FORUM]: StyleSheet.create({
    [BUTTON]: {
      cursor: 'pointer',
      float: 'right',
      marginRight: '20px',
      userSelect: 'none',
    },
  }),
};
