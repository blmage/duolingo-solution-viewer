import { h } from 'preact';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { useStateRef } from 'preact-use';
import { IntlProvider, Localizer, Text, useText } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { noop } from 'duo-toolbox/utils/functions';
import { discardEvent, isAnyInputFocused } from 'duo-toolbox/utils/ui';
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
    const [ modalState, modalStateRef, setModalState ] = useStateRef(STATE_CLOSED);

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
      const isCurrentlyOpened = [ STATE_WILL_OPEN, STATE_OPENING, STATE_OPENED ].includes(modalState);

      if (opened && !isCurrentlyOpened) {
        openModal();
      } else if (!opened && isCurrentlyOpened) {
        closeModal();
      }
    }, [ opened, modalState, openModal, closeModal ]);

    // Closes the modal when the "Escape" key is pressed.
    // Prevents the "Enter" key from moving to the next challenge while the modal is open.
    useEffect(() => {
      const handleKeyDown = event => {
        if (!isAnyInputFocused()) {
          if ('Escape' === event.key) {
            if (![ STATE_CLOSING, STATE_CLOSED ].includes(modalStateRef.current)) {
              onRequestClose();
              discardEvent(event);
            }
          } else if ('Enter' === event.key) {
            if (STATE_OPENED === modalStateRef.current) {
              discardEvent(event);
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown, true);

      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [ modalStateRef, onRequestClose ]);

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
        <div onClick={onRequestClose} className={getElementClassNames(OVERLAY)} style="opacity:0;">
          <div role="dialog" tabIndex="-1" onClick={onRequestClose} className={getElementClassNames(POSITIONER)} style="opacity:0;">
            <div onClick={discardEvent} className={getElementClassNames(WRAPPER)}>
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
        </div>
      </IntlProvider>
    );
  };

export default Modal;

const OVERLAY = 'overlay';
const POSITIONER = 'positioner';
const WRAPPER = 'wrapper';
const CONTENT = 'content';
const CLOSE_BUTTON = 'close_button';
const SIZE_BUTTON = 'size_button';

const CLASS_NAMES = {
  [BASE]: {
    // Copied from the modal backdrop ('*[data-test="drawer-backdrop"'] at the moment).
    // The class name responsible for the opacity, if any, must not be included here.
    [OVERLAY]: [ '_3wtIn', 'Vm8CO', '_1Fnem', '_3ovH6' ],
    // Copied from the global wrapper of the "Report" modal content.
    // The class name responsible for the opacity, if any, must not be included here.
    [POSITIONER]: [ '_3Mzt6', '_3ovH6' ],
    // Copied from the closing button of the "Report" modal.
    [CLOSE_BUTTON]: [ 'eJbBB', 'rXoiv' ],
    [SIZE_BUTTON]: [ 'eJbBB', 'rXoiv' ],
    // Copied from the direct wrapper of the "Report" modal content.
    [WRAPPER]: [ '_1yFTM', '_3fFQQ', 'FohH5', '_2pgzh' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 0,
      position: 'fixed !important',
      transitionDuration: '300ms',
    },
    [POSITIONER]: {
      maxHeight: 'calc(95vh - 30px)',
      maxWidth: 'calc(95vw - 30px)',
      opacity: 0,
      transitionDuration: '300ms',
      '@media (max-width: 699px)': {
        maxHeight: '95vh',
        maxWidth: '95vw',
      },
    },
    [WRAPPER]: {
      maxHeight: 'calc(100vh - 90px)',
      padding: '30px',
      position: 'relative',
    },
    [CONTENT]: {
      height: '100%',
      margin: 0,
      maxHeight: 'calc(100vh - 150px)',
      overflowY: 'auto',
      paddingRight: '10px',
      position: 'relative',
      width: '100%',
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
    [WRAPPER]: {
      maxWidth: '100%',
    },
    [CONTENT]: {
      maxWidth: '100%',
    },
  }),
  [MODAL_SIZE_MAXIMIZED]: StyleSheet.create({
    [POSITIONER]: {
      height: 'calc(95vh - 30px)',
      margin: '0 auto',
      maxHeight: 'none',
      maxWidth: 'none',
      width: 'calc(95vw - 30px)',
    },
    [WRAPPER]: {
      height: '100%',
      maxWidth: '100%',
      width: '100%',
    },
    [CONTENT]: {
      maxWidth: '100%',
    },
  }),
  [STATE_WILL_OPEN]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 0,
      pointerEvents: 'none',
    },
    [POSITIONER]: {
      opacity: 0,
      pointerEvents: 'none',
    },
  }),
  [STATE_OPENING]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 1,
    },
    [POSITIONER]: {
      opacity: 0,
      pointerEvents: 'none',
    },
  }),
  [STATE_OPENED]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 1,
    },
    [POSITIONER]: {
      opacity: 1,
    },
  }),
  [STATE_CLOSING]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 0,
      pointerEvents: 'none',
    },
    [POSITIONER]: {
      opacity: 0,
      pointerEvents: 'none',
    }
  }),
  [STATE_CLOSED]: StyleSheet.create({
    [OVERLAY]: {
      opacity: 0,
      pointerEvents: 'none',
    },
    [POSITIONER]: {
      opacity: 0,
      pointerEvents: 'none',
    },
  }),
};
