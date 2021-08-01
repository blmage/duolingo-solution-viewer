import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text, useText } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { noop } from 'duo-toolbox/utils/functions';
import { discardEvent } from 'duo-toolbox/utils/ui';
import { BASE, useImageCdnUrl, useLocalStorageList, useStyles } from './index';

const STATE_WILL_OPEN = 'will_open';
const STATE_OPENING = 'opening';
const STATE_OPENED = 'opened';
const STATE_CLOSING = 'closing';
const STATE_CLOSED = 'closed';

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

/**
 * The path of the close icon on the image CDN.
 *
 * @type {string}
 */
const CLOSE_ICON_CDN_PATH = 'images/x.svg';

const Modal =
  ({
     children,
     opened = true,
     onAfterOpen = noop,
     onAfterClose = noop,
     onRequestClose = noop,
   }) => {
    const [ modalState, setModalState ] = useState(STATE_CLOSED);

    const {
      state: modalSize,
      nextState: nextModalSize,
      next: setNextModalSize,
    } = useLocalStorageList(
      'modal-size',
      Object.keys(MODAL_SIZES),
      MODAL_SIZE_DEFAULT
    );

    const contentWrapper = useRef();
    const openedTimeout = useRef(null);

    // Opens the modal with an effect similar to Duolingo's.
    const openModal = useCallback(() => {
      setModalState(STATE_WILL_OPEN);

      setTimeout(() => setModalState(STATE_OPENING), 1);

      openedTimeout.current = setTimeout(() => {
        setModalState(STATE_OPENED);
        setTimeout(() => onAfterOpen());
        contentWrapper.current?.focus();
      }, 300);
    }, [ onAfterOpen, setModalState, openedTimeout ]);

    // Closes the modal with an effect similar to Duolingo's.
    const closeModal = useCallback(() => {
      setModalState(STATE_CLOSING);

      setTimeout(() => {
        setModalState(STATE_CLOSED);
        setTimeout(() => onAfterClose());
      }, 300);

      openedTimeout.current && clearTimeout(openedTimeout.current);
    }, [ onAfterClose, setModalState, openedTimeout ]);

    // Opens / closes the modal when requested.
    useEffect(() => {
      const isCurrentlyOpened = [ STATE_WILL_OPEN, STATE_OPENING, STATE_OPENED ].indexOf(modalState) >= 0;

      if (opened && !isCurrentlyOpened) {
        openModal();
      } else if (!opened && isCurrentlyOpened) {
        closeModal();
      }
    }, [ opened, modalState, openModal, closeModal ]);

    // Closes the modal when the "Escape" key is pressed.
    useEffect(() => {
      const handleKeyDown = event => {
        if ('Escape' === event.key) {
          onRequestClose();
          discardEvent(event);
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [ onRequestClose ]);

    const { modalSizeTitle } = useText({
      modalSizeTitle: (
        <Text id={`modal.${MODAL_SIZES[nextModalSize].actionTitleId}`}>
          {MODAL_SIZES[nextModalSize].defaultActionTitle}
        </Text>
      )
    });

    const closeIconUrl = useImageCdnUrl(CLOSE_ICON_CDN_PATH);
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ modalState, modalSize ]);

    if (STATE_CLOSED === modalState) {
      return null;
    }

    return (
      <IntlProvider scope="modal">
        <div onClick={onRequestClose} className={getElementClassNames(OVERLAY)}>
          <div role="dialog" tabIndex="-1" onClick={discardEvent} className={getElementClassNames(WRAPPER)}>
            <div onClick={onRequestClose} className={getElementClassNames(CLOSE_BUTTON)}>
              <Localizer>
                <img
                  src={closeIconUrl}
                  alt={<Text id="close">Close</Text>}
                  title={<Text id="close">Close</Text>}
                />
              </Localizer>
            </div>

            <div title={modalSizeTitle} onClick={setNextModalSize} className={getElementClassNames(SIZE_BUTTON)}>
              {MODAL_SIZES[nextModalSize].actionLabel}
            </div>

            <div ref={contentWrapper} tabIndex="0" className={getElementClassNames(CONTENT)}>
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
    // The class name responsible for the opacity is used below.
    [OVERLAY]: [ '_1tTsl', '_36g-h', 'xtPuL' ],
    // Copied from the global wrapper of the "Report" modal content.
    // The class name responsible for the opacity is also used below.
    [WRAPPER]: [ '_1hEOp', '_13Rl7', '_3lUbm', 'xtPuL' ],
    // Copied from the closing button of the "Report" modal.
    [CLOSE_BUTTON]: [ 'FrL-W' ],
    [SIZE_BUTTON]: [ 'FrL-W' ],
    // Copied from the direct wrapper of the "Report" modal content.
    [CONTENT]: [ '_2D1-v' ],
  },
  [STATE_WILL_OPEN]: {
    // Found in the "app" stylesheet, or by debugging the modal animation.
    // Applies full transparency and disable pointer events.
    [OVERLAY]: [ '_1edTR' ],
    [WRAPPER]: [ '_1edTR' ],
  },
  [STATE_OPENING]: {
    // Found in the "app" stylesheet, or by debugging the modal animation.
    // Applies full opacity.
    [OVERLAY]: [ '_18W4a', ],
    [WRAPPER]: [ '_1edTR' ],
  },
  [STATE_OPENED]: {
    [OVERLAY]: [ '_18W4a' ],
    [WRAPPER]: [ '_18W4a' ],
  },
  [STATE_CLOSING]: {
    [OVERLAY]: [ '_1edTR' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [OVERLAY]: {
      transitionDuration: '300ms',
    },
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
      transitionDuration: '300ms',
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
