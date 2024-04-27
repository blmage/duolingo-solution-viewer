import { h, Fragment } from 'preact';
import { useCallback, useRef } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { noop } from 'duo-toolbox/utils/functions';
import { scrollElementIntoParentView  } from 'duo-toolbox/utils/ui';
import { BASE, CONTEXT_CHALLENGE, useLocalStorage, useStyles } from './index';
import SolutionList from './SolutionList';
import UserReference from './UserReference';
import { SOLUTION_LIST_TYPE_COMPACT } from '../constants';

const ChallengeSolutions =
  ({
     context = CONTEXT_CHALLENGE,
     statement = '',
     solutions: {
         type = SOLUTION_LIST_TYPE_COMPACT,
         otherTypes = [],
         list: solutions = [],
         matchingData = {},
     } = {},
     userReference = '',
     isLoading = false,
     onListTypeChange = noop,
     onUserReferenceUpdate = noop,
     isUserReferenceEditable = true,
     scrollOffsetGetter = (() => 0),
   }) => {
    const [ isUserReferencePinned, setIsUserReferencedPinned ] = useLocalStorage('user_reference_pinned', false);

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
    ]);

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    if (0 === solutions.length) {
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
            reference={userReference}
            onUpdate={onUserReferenceUpdate}
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

        <div className={getElementClassNames(SOLUTION_LIST_WRAPPER)}>
          <SolutionList
            ref={listWrapper}
            context={context}
            type={type}
            otherTypes={otherTypes}
            solutions={solutions}
            matchingData={matchingData}
            onTypeChange={onListTypeChange}
            onPageChange={onSolutionListChange}
            scrollOffsetGetter={fullScrollOffsetGetter}
          />

          {isLoading && <div className={getElementClassNames(LOADER)} />}
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
const SOLUTION_LIST_WRAPPER = 'solution_list_wrapper';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [REFERENCE_WRAPPER__PINNED]: [
      // Found in the "app" stylesheet. Adds the page background color.
      'FohH5',
      // Copied by searching for the main (link) color without side effects.
      '_1PPA6',
    ],
    // Copied from the closing button of the "Report" modal.
    [PIN_BUTTON]: [ 'eJbBB', 'rXoiv' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [LOADER]: {
      background: 'currentColor',
      borderRadius: '5px',
      bottom: '0',
      left: '0',
      opacity: '0.15',
      position: 'absolute',
      right: '0',
      top: '-5px',
      zIndex: '1',
    },
    [SOLUTION_LIST_WRAPPER]: {
      position: 'relative',
    }
  }),
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [REFERENCE_WRAPPER]: {
      paddingRight: '40px',
      position: 'relative',
      zIndex: '2',
    },
    [REFERENCE_WRAPPER__PINNED]: {
      padding: '0 40px 0 0 !important',
      position: 'sticky',
      top: '-1px',
      zIndex: '2',
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
