import { h, Fragment } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { isArray } from 'lodash';
import { BASE, CONTEXT_CHALLENGE, useStyles } from './base';
import Loader from './Loader';
import SolutionList from './SolutionList';
import UserReference from './UserReference';
import { getScrollableAncestor, noop } from '../functions';

const ChallengeSolutions =
  ({
     context = CONTEXT_CHALLENGE,
     statement = '',
     solutions = [],
     userReference = '',
     onUserReferenceUpdate = noop,
     isUserReferenceEditable = true,
     getScrollOffset = (() => 0),
   }) => {
    const listWrapper = useRef();

    const [ isLoading, setIsLoading ] = useState(false);
    const [ currentSolutions, setCurrentSolutions ] = useState(solutions);
    const [ currentUserReference, setCurrentUserReference ] = useState(userReference);

    const getElementClassNames = useStyles({}, STYLE_SHEETS, [ context ]);

    // Updates the user reference and waits for a new list of solutions.
    const updateUserReference = useCallback(newReference => {
      setIsLoading(true);
      setCurrentUserReference(newReference);

      Promise.resolve(onUserReferenceUpdate(newReference))
        .then(solutions => {
          isArray(solutions)
            ? setCurrentSolutions(solutions)
            : setCurrentUserReference(currentUserReference);
        }).catch(() => {
          setCurrentUserReference(currentUserReference);
        }).then(() => {
          setIsLoading(false);
        });
    }, [
      onUserReferenceUpdate,
      setIsLoading,
      setCurrentSolutions,
      currentUserReference,
      setCurrentUserReference,
    ]);

    // Scrolls to the top of the solution list whenever it changes.
    const onSolutionListChange = useCallback(() => {
      if (listWrapper.current) {
        const parent = getScrollableAncestor(listWrapper.current);
        const offset = getScrollOffset() || 0;
        parent.scrollTo({ top: listWrapper.current.offsetTop - offset - 10, behavior: 'smooth' });
      }
    }, [ getScrollOffset, listWrapper, currentSolutions ]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <UserReference context={context}
                       reference={currentUserReference}
                       onChange={updateUserReference}
                       isEditable={isUserReferenceEditable && !isLoading} />
        <div ref={listWrapper}>
          {isLoading
            ? (
              <div className={getElementClassNames(LOADER)}>
                <Loader />
              </div>
            ) : (
              <SolutionList context={context}
                            solutions={currentSolutions}
                            isScoreAvailable={'' !== currentUserReference}
                            onPageChange={onSolutionListChange} />
            )}
        </div>
      </IntlProvider>
    );
  };

export default ChallengeSolutions;

const LOADER = 'loader';

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [LOADER]: {
      padding: '0 0 18px',
      textAlign: 'center',
    },
  }),
};
