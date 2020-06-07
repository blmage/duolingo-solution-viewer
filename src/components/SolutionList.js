import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { identity, noop } from 'lodash';
import { it } from 'param.macro';
import moize from 'moize';
import { BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, useLocalStorage, useLocalStorageList, useStyles } from './base';
import Pagination from './Pagination';
import { invertComparison } from '../functions';
import * as solution from '../solutions';

const TITLE = 'title';
const TITLE_TEXT = 'title_text';
const TITLE_LINK_WRAPPER = 'title_link_wrapper';
const SORT_LINK = 'sort_link';
const SORT_TYPE_LABEL = 'sort_type_label';
const SORT_DIRECTION_LABEL = 'sort_direction_label';
const SOLUTION = 'solution';
const PAGINATION_WRAPPER = 'pagination';
const PAGINATION_FOOTER = 'pagination_footer';
const PAGINATION_STATE = 'pagination_state';
const PAGINATION_SIZE_WRAPPER = 'pagination_size_wrapper';
const CURRENT_PAGE_SIZE = 'current_page_size';
const PAGE_SIZE_LINK = 'page_size_link';
const PAGE_SIZE_SELECT_WRAPPER = 'page_size_select_wrapper';
const PAGE_SIZE_SELECT = 'page_size_select';
const PAGE_SIZE_OPTION = 'page_size_option';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [SORT_LINK]: [ '_2rA41' ],
    [PAGINATION_WRAPPER]: [ '_1qa4z' ],
    [PAGE_SIZE_LINK]: [ '_2rA41' ],
    [PAGE_SIZE_SELECT_WRAPPER]: [ '_2rA41' ],
    [PAGE_SIZE_SELECT]: [ '_2rA41' ],
  },
  [CONTEXT_FORUM]: {
    [SOLUTION]: [ '_2qRu2' ],
    [SORT_LINK]: [ 'uFNEM' ],
    [SORT_TYPE_LABEL]: [ 'D9gQ7' ],
    [PAGE_SIZE_SELECT_WRAPPER]: [ 'uFNEM' ],
    [PAGE_SIZE_SELECT]: [ 'uFNEM' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [TITLE]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    [TITLE_TEXT]: {
      marginRight: '1em',
      '@media (max-width: 699px)': {
        marginBottom: '0.5em',
      },
    },
    [TITLE_LINK_WRAPPER]: {
      '@media (any-pointer: coarse)': {
        lineHeight: '2em',
      },
      '@media (max-width: 699px)': {
        marginBottom: '0.5em',
      },
    },
    [SORT_LINK]: {
      cursor: 'pointer',
      fontSize: '0.75em',
      marginRight: '0.5em',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      '@media (any-pointer: coarse)': {
        display: 'inline-block',
        padding: '0 1em',
        position: 'relative',
        ':active': {
          transform: 'translate3d(0, 2px, 0)',
          ':before': {
            borderWidth: '2px',
          },
        },
        ':before': {
          borderColor: 'currentColor',
          borderRadius: '12px',
          borderStyle: 'solid',
          borderWidth: '2px 2px 4px',
          bottom: 0,
          content: '""',
          display: 'block',
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
      },
    },
    [SORT_TYPE_LABEL]: {
      userSelect: 'none',
    },
    [SORT_DIRECTION_LABEL]: {
      fontSize: '1.2em',
      fontWeight: '900',
    },
    [SOLUTION]: {
      padding: '0.4em 0.5em 0.3em',
      ':nth-child(odd)': {
        background: 'rgba(0, 0, 0, 0.125)',
      },
    },
    [PAGINATION_WRAPPER]: {
      userSelect: 'none',
    },
    [PAGINATION_FOOTER]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: '1em',
    },
    [PAGINATION_STATE]: {
      margin: '0 0.65em 0.5em',
    },
    [PAGINATION_SIZE_WRAPPER]: {
      alignItems: 'center',
      display: 'flex',
      fontSize: '0.85em',
      margin: '0 0.65em 0.5em',
    },
    [CURRENT_PAGE_SIZE]: {
      margin: '0 0.25em',
      '@media (any-pointer: coarse)': {
        display: 'none',
      }
    },
    [PAGE_SIZE_LINK]: {
      cursor: 'pointer',
      margin: '0 0.25em',
      '@media (any-pointer: coarse)': {
        display: 'none',
      }
    },
    [PAGE_SIZE_SELECT_WRAPPER]: {
      display: 'none',
      marginLeft: '0.5em',
      position: 'relative',
      // This fixes the display of the border with Darklingo++.
      transform: 'translate3d(0, 0, 0)',
      ':active': {
        transform: 'translate3d(0, 2px, 0)',
        ':before': {
          borderWidth: '2px',
        },
      },
      ':before': {
        borderColor: 'currentColor',
        borderRadius: '12px',
        borderStyle: 'solid',
        borderWidth: '2px 2px 4px',
        bottom: 0,
        content: '""',
        display: 'block',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: -1,
      },
      '@media (any-pointer: coarse)': {
        display: 'block',
      },
    },
    [PAGE_SIZE_SELECT]: {
      appearance: 'none',
      background: 'none',
      border: 0,
      fontWeight: 'bold',
      padding: '0.75em',
      textAlign: 'center',
      textAlignLast: 'center',
    },
    [PAGE_SIZE_OPTION]: {
      background: 'initial',
      color: 'initial',
    },
  }),
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [PAGINATION_WRAPPER]: {
      bottom: '0',
      paddingTop: '0.1em',
      position: 'sticky',
    },
  }),
  [CONTEXT_FORUM]: StyleSheet.create({
    [TITLE_LINK_WRAPPER]: {
      '@media (max-width: 699px)': {
        marginBottom: '0.5em',
      },
    },
    [SORT_TYPE_LABEL]: {
      fontWeight: 'normal',
      marginRight: '0.5em',
      textTransform: 'none',
    },
  }),
};

const SORT_TYPE_ALPHABETICAL = 'alphabetical';
const SORT_TYPE_SIMILARITY = 'similarity';

const SORT_TYPES = {
  [SORT_TYPE_SIMILARITY]: {
    labelId: 'similarity_sort',
    defaultLabel: 'Similarity sort',
    actionLabelId: 'sort_by_similarity',
    defaultActionLabel: 'Sort by similarity',
  },
  [SORT_TYPE_ALPHABETICAL]: {
    labelId: 'alphabetical_sort',
    defaultLabel: 'Alphabetical sort',
    actionLabelId: 'sort_alphabetically',
    defaultActionLabel: 'Sort alphabetically',
  },
};

/**
 * @function
 * @param {boolean} isScoreAvailable Whether solutions have scores in the current context.
 * @returns {string[]} The available sort types.
 */
const getAvailableSortTypes = moize(isScoreAvailable => {
  let sortTypes = Object.keys(SORT_TYPES);

  if (!isScoreAvailable) {
    sortTypes = sortTypes.filter(SORT_TYPE_SIMILARITY !== it);
  }

  return sortTypes;
});

const SORT_DIRECTION_ASC = 'asc';
const SORT_DIRECTION_DESC = 'desc';

const SORT_DIRECTIONS = {
  [SORT_DIRECTION_ASC]: {
    label: '↑',
    actionLabelId: 'sort_ascending',
    defaultActionLabel: 'Sort in ascending order',
  },
  [SORT_DIRECTION_DESC]: {
    label: '↓',
    actionLabelId: 'sort_descending',
    defaultActionLabel: 'Sort in descending order',
  },
};

const PAGE_SIZE_ALL = 'all';
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [ 10, 20, 50, 200, PAGE_SIZE_ALL ];

const SolutionList = ({ solutions = [], context = CONTEXT_CHALLENGE, onPageChange = noop }) => {
  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

  const [ page, setRawPage ] = useState(1);
  const shouldTriggerPageChange = useRef();
  const [ pageSize, setRawPageSize ] = useLocalStorage('page_size', DEFAULT_PAGE_SIZE);

  const setPage = useCallback(page => {
    setRawPage(page);
    shouldTriggerPageChange.current = true;
  }, [ setRawPage ]);

  const setPageSize = useCallback(size => {
    setRawPageSize(size);

    if (PAGE_SIZE_ALL === size) {
      setRawPage(1);
    } else {
      const sizeValue = Number(size);

      if (PAGE_SIZES.indexOf(sizeValue) === -1) {
        return;
      }

      const oldSize = (PAGE_SIZE_ALL === pageSize)
        ? solutions.length
        : Math.min(pageSize, solutions.length);

      setRawPage(Math.ceil(((page - 1) * oldSize + 1) / sizeValue));
    }

    shouldTriggerPageChange.current = true;
  }, [ page, pageSize, solutions.length, setRawPageSize ]);


  const sortTypes = getAvailableSortTypes(CONTEXT_CHALLENGE === context);

  const {
    state: sortType,
    nextState: nextSortType,
    next: setNextSortType,
  } = useLocalStorageList(
    'sort-type',
    sortTypes,
    sortTypes[0]
  );

  const {
    state: sortDirection,
    nextState: nextSortDirection,
    next: setNextSortDirection,
  } = useLocalStorageList(
    'sort-direction',
    Object.keys(SORT_DIRECTIONS),
    SORT_DIRECTION_DESC
  );

  const [ sortedSolutions, setSortedSolutions ] = useState([]);

  useEffect(() => {
    const compareSolutions = SORT_TYPE_SIMILARITY === sortType
      ? (SORT_DIRECTION_ASC === sortDirection ? invertComparison : identity)(solution.compareScores)
      : (SORT_DIRECTION_DESC === sortDirection ? invertComparison : identity)(solution.compareValues);

    setSortedSolutions(solutions.sort(compareSolutions));
  }, [ solutions, sortType, sortDirection ]);

  const renderSolutionItem = useCallback(value => (
    <li className={getElementClassNames(SOLUTION)}>
      {solution.toDisplayableString(value)}
    </li>
  ), [ getElementClassNames ]);

  const [ solutionItems, setSolutionItems ] = useState([]);

  useEffect(() => {
    const pageSolutions = (PAGE_SIZE_ALL === pageSize)
      ? sortedSolutions
      : sortedSolutions.slice((page - 1) * pageSize, page * pageSize);

    setSolutionItems(pageSolutions.map(renderSolutionItem));
  }, [ sortedSolutions, sortType, sortDirection, page, pageSize, renderSolutionItem ]);

  useEffect(() => {
    if (shouldTriggerPageChange.current) {
      setTimeout(onPageChange());
      shouldTriggerPageChange.current = false;
    }
  }, [ solutionItems, onPageChange, shouldTriggerPageChange ]);


  const getSizeLabel = size => (PAGE_SIZE_ALL !== size)
    ? `${size}`
    : <Text id="all">all</Text>;

  const renderSizeLink = useCallback(size => (String(size) === String(pageSize))
    ? (
      <span className={getElementClassNames(CURRENT_PAGE_SIZE)}>
          {getSizeLabel(size)}
        </span>
    ) : (
      <a onClick={() => setPageSize(size)} className={getElementClassNames(PAGE_SIZE_LINK)}>
        {getSizeLabel(size)}
      </a>
    ),
    [ pageSize, setPageSize, getElementClassNames ]
  );

  const renderSizeOption = useCallback(size => (
    <option value={size}
            selected={String(size) === String(pageSize)}
            className={getElementClassNames(PAGE_SIZE_OPTION)}>
      {getSizeLabel(size)}
    </option>
  ), [ pageSize, getElementClassNames ]);

  if (0 === solutions.length) {
    return null;
  }

  const [ firstIndex, lastIndex ] = (PAGE_SIZE_ALL === pageSize)
    ? [ 1, solutions.length ]
    : [ (page - 1) * pageSize + 1, Math.min(solutions.length, page * pageSize) ];

  return (
    <IntlProvider scope="solution.list">
      <div>
        <h3 className={getElementClassNames(TITLE)}>
          <span className={getElementClassNames(TITLE_TEXT)}>
            <Text id="correct_solutions">Correct solutions:</Text>
          </span>
          <div className={getElementClassNames(TITLE_LINK_WRAPPER)}>
            <Localizer>
              {(sortTypes.length > 1)
                ? (
                  <a className={getElementClassNames(SORT_LINK)}
                     onClick={setNextSortType}
                     title={
                       <Text id={SORT_TYPES[nextSortType].actionLabelId}>
                         {SORT_TYPES[nextSortType].defaultActionLabel}
                       </Text>
                     }>
                    <span className={getElementClassNames(SORT_TYPE_LABEL)}>
                      <Text id={SORT_TYPES[sortType].labelId}>
                        {SORT_TYPES[sortType].defaultLabel}
                      </Text>
                    </span>
                  </a>
                ) : (
                  <span className={getElementClassNames(SORT_TYPE_LABEL)}>
                    <Text id={SORT_TYPES[sortType].labelId}>
                      {SORT_TYPES[sortType].defaultLabel}
                    </Text>
                  </span>
                )}
              <a className={getElementClassNames(SORT_LINK)}
                 onClick={setNextSortDirection}
                 title={
                   <Text id={SORT_DIRECTIONS[nextSortDirection].actionLabelId}>
                     {SORT_DIRECTIONS[nextSortDirection].defaultActionLabel}
                   </Text>
                 }>
                <span className={getElementClassNames(SORT_DIRECTION_LABEL)}>
                  {SORT_DIRECTIONS[sortDirection].label}
                </span>
              </a>
            </Localizer>
          </div>
        </h3>
        <ul>{solutionItems}</ul>
        <div className={getElementClassNames(PAGINATION_WRAPPER)}>
          {(PAGE_SIZE_ALL !== pageSize) && (
            <Pagination
              activePage={page}
              itemCountPerPage={pageSize}
              totalItemCount={solutions.length}
              onChange={setPage}
              context={context}
            />)}
          <div className={getElementClassNames(PAGINATION_FOOTER)}>
            <div className={getElementClassNames(PAGINATION_STATE)}>
              {firstIndex} - {lastIndex} / {solutions.length}
            </div>
            <div className={getElementClassNames(PAGINATION_SIZE_WRAPPER)}>
              <Text id="per_page">per page:</Text>
              {PAGE_SIZES.map(renderSizeLink)}
              <div className={getElementClassNames(PAGE_SIZE_SELECT_WRAPPER)}>
                <select onChange={event => setPageSize(event.target.value)}
                        className={getElementClassNames(PAGE_SIZE_SELECT)}>
                  {PAGE_SIZES.map(renderSizeOption)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IntlProvider>
  );
};

export default SolutionList;
