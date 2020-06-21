import { h } from 'preact';
import { StyleSheet } from 'aphrodite';
import { BASE, useStyles } from './base';

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

const animationKeyFrames = {
  '0%, 80%, 100%': {
    opacity: 0.25,
  },
  '40%': {
    opacity: 1,
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      alignItems: 'center',
      display: 'inline-flex',
      justifyContent: 'space-between',
    },
    [BALL]: {
      animationName: [ animationKeyFrames ],
      animationDuration: '1.6s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      backgroundColor: 'currentColor',
      borderRadius: '100%',
      height: '8px',
      margin: '0 5px',
      width: '8px',
      ':nth-child(1)': {
        animationDelay: '-0.32s',
      },
      ':nth-child(2)': {
        animationDelay: '-0.16s',
      },
    },
  }),
};
