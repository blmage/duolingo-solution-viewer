import { h, Fragment } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { isArray, noop, scrollElementIntoParentView } from '../functions';
import { BASE, CONTEXT_CHALLENGE, useLocalStorage, useStyles } from './index';
import Loader from './Loader';
import SolutionList from './SolutionList';
import UserReference from './UserReference';

const ChallengeSolutions =
  ({
     context = CONTEXT_CHALLENGE,
     statement = '',
     solutions = [],
     matchingData = {},
     userReference = '',
     onUserReferenceUpdate = noop,
     isUserReferenceEditable = true,
     scrollOffsetGetter = (() => 0),
   }) => {
    const [ isLoading, setIsLoading ] = useState(false);
    const [ currentSolutions, setCurrentSolutions ] = useState(solutions);
    const [ currentUserReference, setCurrentUserReference ] = useState(userReference);
    const [ isUserReferencePinned, setIsUserReferencedPinned ] = useLocalStorage('user_reference_pinned', false);

    // Updates the user reference and waits for a new list of solutions.
    const updateUserReference = useCallback(newReference => {
      setIsLoading(true);
      setCurrentUserReference(newReference);

      Promise.resolve(onUserReferenceUpdate(newReference))
        .then(solutions => {
          if (isArray(solutions)) {
            setCurrentSolutions(solutions)
          } else {
            setCurrentUserReference(currentUserReference);
          }
        }).catch(() => (
          setCurrentUserReference(currentUserReference)
        )).then(() => {
          setIsLoading(false);
        });
    }, [
      onUserReferenceUpdate,
      setIsLoading,
      setCurrentSolutions,
      currentUserReference,
      setCurrentUserReference,
    ]);

    const listWrapper = useRef();
    const referenceWrapper = useRef();

    const fullScrollOffsetGetter = useCallback(() => (
      10
      + scrollOffsetGetter()
      + (isUserReferencePinned && referenceWrapper.current?.offsetHeight || 0)
    ), [ scrollOffsetGetter, isUserReferencePinned, referenceWrapper ]);

    // Scrolls to the top of the solution list whenever it changes.
    const onSolutionListChange = useCallback(() => {
      listWrapper.current
      && scrollElementIntoParentView(listWrapper.current, fullScrollOffsetGetter(), 'smooth');
    }, [ // eslint-disable-line react-hooks/exhaustive-deps
      listWrapper,
      fullScrollOffsetGetter,
      currentSolutions,
    ]);

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    if (0 === currentSolutions.length) {
      return null;
    }

    return (
      <IntlProvider scope="challenge">
        {('' !== statement) && (
          <Fragment>
            <h3>
              <Text id="statement">Statement:</Text>
            </h3>
            <p>{statement}</p>
          </Fragment>
        )}

        <div
          ref={referenceWrapper}
          className={getElementClassNames([
            REFERENCE_WRAPPER,
            isUserReferencePinned && REFERENCE_WRAPPER__PINNED
          ])}
        >
          <UserReference
            context={context}
            reference={currentUserReference}
            onUpdate={updateUserReference}
            isEditable={isUserReferenceEditable && !isLoading}
          />
          {(CONTEXT_CHALLENGE === context)
          && (
            <IntlProvider scope="user_reference">
              <Localizer>
                <div
                  onClick={() => setIsUserReferencedPinned(!isUserReferencePinned)}
                  title={(
                    <Text id={isUserReferencePinned ? 'unpin' : 'pin'}>
                      {isUserReferencePinned ? 'Unpin' : 'Pin'}
                    </Text>
                  )}
                  className={getElementClassNames([
                    PIN_BUTTON,
                    isUserReferencePinned && PIN_BUTTON__PINNED
                  ])}
                >
                  <FontAwesomeIcon
                    icon={[ 'far', 'thumbtack' ]}
                    className={getElementClassNames(PIN_BUTTON_ICON)}
                  />
                </div>
              </Localizer>
            </IntlProvider>
          )}
        </div>

        <div>
          {isLoading
            ? (
              <div className={getElementClassNames(LOADER)}>
                <Loader />
              </div>
            ) : (
              <SolutionList
                ref={listWrapper}
                context={context}
                solutions={currentSolutions}
                matchingData={matchingData}
                onPageChange={onSolutionListChange}
                scrollOffsetGetter={fullScrollOffsetGetter}
              />
            )}
        </div>
      </IntlProvider>
    );
  };

export default ChallengeSolutions;

const LOADER = 'loader';
const REFERENCE_WRAPPER = 'reference_wrapper';
const REFERENCE_WRAPPER__PINNED = 'reference_wrapper__pinned';
const PIN_BUTTON = 'pin_button';
const PIN_BUTTON__PINNED = 'pin_button__pinned';
const PIN_BUTTON_ICON = 'pin_button_icon';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [REFERENCE_WRAPPER__PINNED]: [
      // Found in the "app" stylesheet. Adds the page background color.
      '_3lUbm',
      // Copied by searching for the main (link) color without side-effects.
      '_2__FI',
    ],
    // Copied from the closing button of the "Report" modal.
    [PIN_BUTTON]: [ 'FrL-W' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [LOADER]: {
      padding: '0 0 18px',
      textAlign: 'center',
    },
  }),
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [REFERENCE_WRAPPER]: {
      paddingRight: '40px',
      position: 'relative',
    },
    [REFERENCE_WRAPPER__PINNED]: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      // Use an absolute border to preserve margin collapse.
      ':after': {
        background: 'inherit',
        bottom: '-8px',
        content: '""',
        display: 'block',
        height: '8px',
        left: 0,
        position: 'absolute',
        width: '100%',
      },
    },
    [PIN_BUTTON]: {
      border: 0,
      top: '50%',
      transform: 'translateY(-50%) rotate(90deg)',
    },
    [PIN_BUTTON__PINNED]: {
      transform: 'translateY(-50%) rotate(0)',
    },
  }),
};
