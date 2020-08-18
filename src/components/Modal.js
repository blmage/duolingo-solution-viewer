import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { BASE, useLocalStorageList, useStyles } from './base';
import { CLOSE_ICON_CDN_PATH } from '../constants';
import { discardEvent, getImageCdnBaseUrl, noop } from '../functions';

const STATE_PENDING = Symbol('pending');
const STATE_OPENING = Symbol('opening');
const STATE_OPENED = Symbol('opened');
const STATE_CLOSING = Symbol('closing');
const STATE_CLOSED = Symbol('closed');

const MODAL_SIZE_DEFAULT = 'default';
const MODAL_SIZE_FIT_TO_CONTENT = 'fit_to_content';
const MODAL_SIZE_MAXIMIZED = 'maximized';

const MODAL_SIZES = {
  [MODAL_SIZE_DEFAULT]: {
    actionLabel: '↑',
    actionTitleId: 'minimize',
    defaultActionTitle: 'Minimize',
  },
  [MODAL_SIZE_FIT_TO_CONTENT]: {
    actionLabel: '↓',
    actionTitleId: 'fit_to_content',
    defaultActionTitle: 'Fit to content',
  },
  [MODAL_SIZE_MAXIMIZED]: {
    actionLabel: '↕',
    actionTitleId: 'maximize',
    defaultActionTitle: 'Maximize',
  },
};

const Modal = ({ children, onClose = noop }) => {
  const [ modalState, setModalState ] = useState(STATE_PENDING);
  const contentWrapper = useRef();
  const openedTimeout = useRef(null);

  const {
    state: modalSize,
    nextState: nextModalSize,
    next: setNextModalSize,
  } = useLocalStorageList(
    'modal-size',
    Object.keys(MODAL_SIZES),
    MODAL_SIZE_DEFAULT
  );

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ modalState, modalSize ]);

  // Closes the modal with an effect similar to Duolingo's.
  const closeModal = useCallback(() => {
    if ([ STATE_CLOSING, STATE_CLOSED ].indexOf(modalState) === -1) {
      setModalState(STATE_CLOSING);

      setTimeout(() => {
        setModalState(STATE_CLOSED);
        onClose();
      }, 300);

      if (openedTimeout.current) {
        clearTimeout(openedTimeout.current);
      }
    }
  }, [ modalState, onClose ]);

  // Closes the modal when the 'Escape' key is pressed.
  useEffect(() => {
    if ([ STATE_CLOSING, STATE_CLOSED ].indexOf(modalState) === -1) {
      const handleKeyDown = event => {
        if ('Escape' === event.key) {
          closeModal();
          discardEvent(event);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [ modalState, closeModal ]);

  // Opens the modal with an effect similar to Duolingo's.
  useEffect(() => {
    if (STATE_PENDING === modalState) {
      setTimeout(() => setModalState(STATE_OPENING), 1);
      openedTimeout.current = setTimeout(() => setModalState(STATE_OPENED), 300);
    }
  }, [ modalState ]);

  // Focuses the content of the modal when it is displayed, to allow scrolling through it using the arrow keys.
  useEffect(() => {
    if (contentWrapper.current) {
      contentWrapper.current.focus();
    }
  }, [ contentWrapper ]);

  if (STATE_CLOSED === modalState) {
    return null;
  }

  return (
    <IntlProvider scope="modal">
      <div className={getElementClassNames(OVERLAY)} onClick={closeModal}>
        <div className={getElementClassNames(WRAPPER)} role="dialog" tabIndex="-1" onClick={discardEvent}>
          <div className={getElementClassNames(CLOSE_BUTTON)} onClick={closeModal}>
            <img src={getImageCdnBaseUrl() + CLOSE_ICON_CDN_PATH} />
          </div>
          <Localizer>
            <div onClick={setNextModalSize}
                 className={getElementClassNames(SIZE_BUTTON)}
                 title={
                   <Text id={MODAL_SIZES[nextModalSize].actionTitleId}>
                     {MODAL_SIZES[nextModalSize].defaultActionTitle}
                   </Text>
                 }>
              {MODAL_SIZES[nextModalSize].actionLabel}
            </div>
          </Localizer>
          <div ref={contentWrapper} className={getElementClassNames(CONTENT)} tabIndex="0">
            {children}
          </div>
        </div>
      </div>
    </IntlProvider>
  );
};

export default Modal;

const OVERLAY = 'overlay';
const WRAPPER = 'wrapper';
const CLOSE_BUTTON = 'close_button';
const SIZE_BUTTON = 'size_button';
const CONTENT = 'content';

const CLASS_NAMES = {
  [BASE]: {
    // Copied from the "Report" modal overlay.
    // The class names responsible for the opacity and animation are used below.
    [OVERLAY]: [ '_2Rpqh', '_36g-h', '_1xa0a' ],
    // Copied from the global wrapper of the "Report" modal content.
    // The class names responsible for the opacity/animation are also used below.
    [WRAPPER]: [ '_1hEOp', '_13Rl7', '_3lUbm', '_1xa0a' ],
    // Copied from the closing button of the "Report" modal.
    [CLOSE_BUTTON]: [ 'FrL-W' ],
    [SIZE_BUTTON]: [ 'FrL-W' ],
    // Copied from the direct wrapper of the "Report" modal content.
    [CONTENT]: [ '_2D1-v' ],
  },
  [STATE_PENDING]: {
    // Found in the "app" stylesheet, or by debugging the modal animation.
    // Applies full transparency and disable pointer events.
    [OVERLAY]: [ '_1VSis' ],
    [WRAPPER]: [ '_1VSis' ],
  },
  [STATE_OPENING]: {
    // Found in the "app" stylesheet, or by debugging the modal animation.
    // Applies full opacity.
    [OVERLAY]: [ '_2vfOI' ],
    [WRAPPER]: [ '_1VSis' ],
  },
  [STATE_OPENED]: {
    [OVERLAY]: [ '_2vfOI' ],
    [WRAPPER]: [ '_2vfOI' ],
  },
  [STATE_CLOSING]: {
    [OVERLAY]: [ '_1VSis' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      maxHeight: 'calc(95vh - 30px)',
      maxWidth: 'calc(95vw - 30px)',
      '@media (max-width: 699px)': {
        maxHeight: '95vh',
        maxWidth: '95vw',
      },
    },
    [CONTENT]: {
      maxHeight: 'calc(95vh - 90px)',
      overflowY: 'auto',
      paddingRight: '0.5em',
      position: 'relative',
    },
    [SIZE_BUTTON]: {
      border: 0,
      borderRadius: '100%',
      bottom: '1px',
      left: 'auto',
      right: '1px',
      top: 'auto',
      transform: 'rotate(-45deg)',
      '@media (max-width: 699px)': {
        fontSize: '1.25em',
      },
    },
  }),
  [MODAL_SIZE_FIT_TO_CONTENT]: StyleSheet.create({
    [CONTENT]: {
      maxWidth: '100%',
    },
  }),
  [MODAL_SIZE_MAXIMIZED]: StyleSheet.create({
    [WRAPPER]: {
      height: 'calc(95vh - 30px)',
      maxHeight: 'none',
      maxWidth: 'none',
      width: 'calc(95vw - 30px)',
      '@media (max-width: 699px)': {
        height: '95vh',
        width: '95vw',
      },
    },
    [CONTENT]: {
      maxWidth: '100%',
      '@media (max-width: 699px)': {
        maxHeight: '100%',
      },
    },
  }),
};
