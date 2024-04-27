import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { discardEvent } from 'duo-toolbox/utils/ui';
import { RESULT_CORRECT, RESULT_INCORRECT, RESULT_NONE } from 'duo-toolbox/duo/challenges';
import * as Solution from '../solutions';
import { CONTEXT_CHALLENGE, useStyles } from './index';
import Loader from './Loader';

const SolutionLink =
  ({
     context = CONTEXT_CHALLENGE,
     solutions: { list: solutions = [] } = {},
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
    [BUTTON]: [
      '_3CCt9',
      '_3HsTU',
      '_2kfEr',
      '_1nlVc',
      '_2fOC9',
      'UCrz7',
      't5wFJ',
      '_2JTJI',
      'bafGS',
      '_2LoNU',
      'VzbUl',
      '_1saKQ',
      '_1AgKJ'
    ],
    // Copied from the direct wrappers of the "Report" and "Discuss" icons and links.
    [BUTTON_CONTENT]: [ '_1-Ukw', '_24Rh2' ],
    // Copied from the "Report" and "Discuss" icons.
    // The class name responsible for the background image is ignored here.
    [ICON]: [ 'sf9Rc', '_29maR', '_3jt-c' ],
    // Copied from the "Report" and "Discuss" titles.
    [TITLE]: [ '_28V9T', '_3yAjN', '_1qfbO', '_2Rt1l' ]
  },
  [RESULT_CORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is correct.
    // Adds the "correct" color.
    [BUTTON]: [ '_1xOpZ', 'jTP0E', '_1pDd6' ],
    // This class is now only defined in Darklingo++, and applies the same color as the other icons.
    [ICON]: [ '_3NwXb' ],
  },
  [RESULT_INCORRECT]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the result is incorrect.
    // Adds the "incorrect" color.
    [BUTTON]: [ 'I5L6p', 'RnDo_', '_3Qruy', '_6RzgV' ],
    // This class is now only defined in Darklingo++, and applies the same color as the other icons.
    [ICON]: [ '_1BszG' ],
  },
  [RESULT_NONE]: {
    // Copied from the wrapper of the "Report" and "Discuss" icons and links when the challenge is skipepd.
    // Adds the "skipped" color.
    [BUTTON]: [ '_3wqVs', '_2JTJI', 'bafGS', '_2LoNU', 'VzbUl', '_1saKQ', '_1AgKJ' ],
  }
};

const STYLE_SHEETS = {
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [BUTTON]: {
      height: '100%',
    },
  }),
};
