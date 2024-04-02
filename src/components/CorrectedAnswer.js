import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { _ } from 'one-liner.macro';
import { RESULT_CORRECT, RESULT_INCORRECT } from 'duo-toolbox/duo/challenges';
import { BASE, useStyles } from './index';

const DISPLAY_MODE_ORIGINAL = 'original';
const DISPLAY_MODE_CORRECTED = 'corrected';

const CorrectedAnswer = ({ diffTokens = [], result = RESULT_CORRECT }) => {
  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ result ]);

  // Renders a diff token.
  const renderToken = useCallback((token, displayMode) => {
    let elementKey = null;

    if (token.added) {
      if (DISPLAY_MODE_CORRECTED === displayMode) {
        return null;
      } else if (!token.ignorable) {
        elementKey = ADDED_TOKEN;
      }
    } else if (token.removed) {
      if (DISPLAY_MODE_ORIGINAL === displayMode) {
        return null;
      } else if (!token.ignorable) {
        elementKey = REMOVED_TOKEN;
      }
    }

    return (
      <span className={getElementClassNames(elementKey)}>
        {token.value}
      </span>
    );
  }, [ getElementClassNames ]);

  const [ originalAnswer, setOriginalAnswer ] = useState([]);
  const [ correctedAnswer, setCorrectedAnswer ] = useState([]);

  // Refreshes both versions of the answer when the diff tokens change.
  useEffect(() => {
    setOriginalAnswer(diffTokens.map(renderToken(_, DISPLAY_MODE_ORIGINAL)));
    setCorrectedAnswer(diffTokens.map(renderToken(_, DISPLAY_MODE_CORRECTED)));
  }, [ diffTokens, renderToken ]);

  if (0 === diffTokens.length) {
    return null;
  }

  return (
    <IntlProvider scope="corrected_answer">
      <h2 className={getElementClassNames(WRAPPER)}>
        <Text id="title">Corrected answer:</Text>
        <div className={getElementClassNames(VALUE)}>
          {originalAnswer}
        </div>
        <div className={getElementClassNames(VALUE)}>
          {correctedAnswer}
        </div>
      </h2>
    </IntlProvider>
  );
}

export default CorrectedAnswer;

const WRAPPER = 'wrapper';
const VALUE = 'value';
const ADDED_TOKEN = 'added_token';
const REMOVED_TOKEN = 'removed_token';

const CLASS_NAMES = {
  [BASE]: {
    // Copied from the direct wrapper of the "Meaning" title and the corresponding value.
    [WRAPPER]: [ '_2ez4I', 'K5mc9' ],
    // Copied from the solution translation.
    [VALUE]: [ '_1UqAr', '_77VI1' ],
  },
  [RESULT_CORRECT]: {
    // Adds the "correct" color.
    [WRAPPER]: [ '_1Nmv6', '_1D8II', '_2BYam' ],
    // Adds the "incorrect" color.
    [ADDED_TOKEN]: [ '_1sqiF', 'RnDo_', '_3Qruy', '_2WmG1' ],
  },
  [RESULT_INCORRECT]: {
    [WRAPPER]: [ '_1sqiF', '_3vF5k', '_2WmG1' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      margin: '10px 0 0',
    },
    [REMOVED_TOKEN]: {
      textDecoration: 'underline',
    },
  }),
};
