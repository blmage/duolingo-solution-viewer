import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { RESULT_CORRECT, RESULT_INCORRECT } from 'duo-toolbox/duo/challenges';
import { BASE, useStyles } from './index';

const ClosestSolution = ({ solution = '', result = RESULT_CORRECT }) => {
  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ result ]);

  if (solution.trim() === '') {
    return null;
  }

  return (
    <IntlProvider scope="closest_solution">
      <h2 className={getElementClassNames(WRAPPER)}>
        <Text id="title">Closest solution:</Text>
        <div className={getElementClassNames(VALUE)}>
            <span>
              <span>{solution}</span>
            </span>
        </div>
      </h2>
    </IntlProvider>
  );
}

export default ClosestSolution;

const WRAPPER = 'wrapper';
const VALUE = 'value';

const CLASS_NAMES = {
  [BASE]: {
    // Copied from the direct wrapper of the "Correct solution" title and the corresponding value.
    [WRAPPER]: [ 'K5mc9', '_1D3fo' ],
    // Copied from the solution value.
    [VALUE]: [ '_1UqAr', 'Dl5qy', '_2jz5U' ],
  },
  [RESULT_CORRECT]: {
    // Adds the "correct" color
    [WRAPPER]: [ '_1D8II', '_2BYam', 'WXwlk', '_6RzgV' ],
  },
  [RESULT_INCORRECT]: {
    // Adds the "incorrect" color.
    [WRAPPER]: [ '_3Qruy', '_2WmG1', 'o-3Ru', '_3wqVs' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      margin: '10px 0 0',
    }
  }),
};
