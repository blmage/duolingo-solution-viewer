import { h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { BASE, useStyles } from './base';
import { RESULT_CORRECT, RESULT_INCORRECT } from '../constants';

const WRAPPER = 'wrapper';
const VALUE = 'value';

const CLASS_NAMES = {
  [BASE]: {
    [WRAPPER]: [ '_36Uyg' ],
    [VALUE]: [ 'TnCw3' ],
  },
  [RESULT_CORRECT]: {
    [WRAPPER]: [ '_11xjL ' ],
  },
  [RESULT_INCORRECT]: {
    [WRAPPER]: [ '_2QxbX' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      marginBottom: '10px',
    }
  }),
};

const ClosestSolution = ({ solution = '', result = RESULT_CORRECT }) => {
  if (solution.trim() === '') {
    return null;
  }

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, result);

  return (
    <IntlProvider scope="solution.closest">
      <h2 className={getElementClassNames(WRAPPER)}>
        <Text id="closest_solution">Closest solution:</Text>
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
