import { h } from 'preact';
import { StyleSheet } from 'aphrodite';
import { BASE, useStyles } from './index';

const Loader = () => {
  const getElementClassNames = useStyles({}, STYLE_SHEETS);

  return (
    <div className={getElementClassNames(WRAPPER)}>
      <div className={getElementClassNames(BALL)} />
      <div className={getElementClassNames(BALL)} />
      <div className={getElementClassNames(BALL)} />
    </div>
  );
};

export default Loader;

const WRAPPER = 'wrapper';
const BALL = 'ball';

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      alignItems: 'center',
      display: 'inline-flex',
      height: '100%',
      justifyContent: 'space-between',
    },
    [BALL]: {
      animationDuration: '2s',
      animationIterationCount: 'infinite',
      animationName: [
        {
          '0%, 80%, 100%': {
            opacity: 0.25,
          },
          '40%': {
            opacity: 1,
            transform: 'scale(1.2)',
          },
        }
      ],
      animationTimingFunction: 'ease-in-out',
      backgroundColor: 'currentColor',
      borderRadius: '100%',
      height: '8px',
      margin: '0 4px',
      width: '8px',
      ':nth-child(1)': {
        animationDelay: '-0.4s',
      },
      ':nth-child(2)': {
        animationDelay: '-0.2s',
      },
    },
  }),
};
