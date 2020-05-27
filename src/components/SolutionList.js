import { h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import lodash from 'lodash';
import { BASE, useLocalStorage, useLocalStorageList, useStyles } from './base';
import Pagination from './Pagination';
import { invertComparison } from '../functions';
import * as solution from '../functions';

const TITLE = 'title';
const TITLE_TEXT = 'title_text';
const SORT_LINK = 'sort_link';
const DIRECTION_LABEL = 'direction_label';
const SOLUTION = 'solution';
const PAGINATION_WRAPPER = 'pagination';
const PAGINATION_FOOTER = 'pagination_footer';
const PAGINATION_STATE = 'pagination_state';
const PAGINATION_SIZES = 'pagination_sizes';
const CURRENT_PAGE_SIZE = 'current_page_size';
const PAGE_SIZE_LINK = 'page_size_link';

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

const CLASS_NAMES = {
  [BASE]: {
    [SORT_LINK]: [ '_2rA41' ],
    [PAGINATION_WRAPPER]: [ '_1qa4z' ],
    [PAGE_SIZE_LINK]: [ '_2rA41' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [TITLE]: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    [TITLE_TEXT]: {
      marginRight: '1em',
    },
    [SORT_LINK]: {
      fontSize: '0.75em',
      marginRight: '0.5em',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      userSelect: 'none',
    },
    [DIRECTION_LABEL]: {
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
      position: 'sticky',
      bottom: '0',
      paddingTop: '0.1em',
      userSelect: 'none',
    },
    [PAGINATION_FOOTER]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '1em',
    },
    [PAGINATION_STATE]: {
      margin: '0 0.6em',
    },
    [PAGINATION_SIZES]: {
      margin: '0 0.6em',
      fontSize: '0.85em',
    },
    [CURRENT_PAGE_SIZE]: {
      margin: '0 0.25em',
    },
    [PAGE_SIZE_LINK]: {
      margin: '0 0.25em',
      cursor: 'pointer',
    },
  })
};

const SORT_TYPE_ALPHABETICAL = 'alphabetical';
const SORT_TYPE_SIMILARITY = 'similarity';

const SORT_TYPES = {
  [SORT_TYPE_ALPHABETICAL]: {
    labelId: 'alphabetical_sort',
    defaultLabel: 'Alphabetical sort',
    actionLabelId: 'sort_alphabetically',
    defaultActionLabel: 'Sort alphabetically',
  },
  [SORT_TYPE_SIMILARITY]: {
    labelId: 'similarity_sort',
    defaultLabel: 'Similarity sort',
    actionLabelId: 'sort_by_similarity',
    defaultActionLabel: 'Sort by similarity',
  },
};

const PAGE_SIZE_ALL = 'all';
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [ 10, 20, 50, 200, PAGE_SIZE_ALL ];

const SolutionList = ({ solutions = [] }) => {
  if (0 === solutions.length) {
    return null;
  }

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS);

  const [ page, setPage ] = useState(1);
  const [ pageSize, setRawPageSize ] = useLocalStorage('page_size', DEFAULT_PAGE_SIZE);

  const setPageSize = useCallback(size => {
    setRawPageSize(size);

    if (PAGE_SIZE_ALL === size) {
      setPage(1);
    } else {
      const oldSize = (PAGE_SIZE_ALL === pageSize)
        ? solutions.length
        : Math.min(pageSize, solutions.length);

      setPage(Math.ceil(((page - 1) * oldSize + 1) / size));
    }
  }, [ page, pageSize ]);

  const {
    state: sortType,
    nextState: nextSortType,
    next: setNextSortType,
  } = useLocalStorageList(
    'sort-type',
    Object.keys(SORT_TYPES),
    SORT_TYPE_SIMILARITY
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
      ? (SORT_DIRECTION_ASC === sortDirection ? invertComparison : lodash.identity)(solution.compareScores)
      : (SORT_DIRECTION_DESC === sortDirection ? invertComparison : lodash.identity)(solution.compareValues);

    setSortedSolutions(solutions.sort(compareSolutions));
  }, [ solutions, sortType, sortDirection ]);

  const renderSolutionItem = value => (
    <li className={getElementClassNames(SOLUTION)}>
      {solution.toDisplayableString(value, false)}
    </li>
  );

  const [ solutionItems, setSolutionItems ] = useState([]);

  useEffect(() => {
    const pageSolutions = (PAGE_SIZE_ALL === pageSize)
      ? sortedSolutions
      : sortedSolutions.slice((page - 1) * pageSize, page * pageSize);

    setSolutionItems(pageSolutions.map(renderSolutionItem));
  }, [ sortedSolutions, sortType, sortDirection, page, pageSize ]);

  const renderSizeLink = useCallback(size => {
    const sizeLabel = (PAGE_SIZE_ALL !== size)
      ? '' + size
      : <Text id="all">all</Text>;

    return (size === pageSize)
      ? <span className={getElementClassNames(CURRENT_PAGE_SIZE)}>{sizeLabel}</span>
      : <a onClick={() => setPageSize(size)} className={getElementClassNames(PAGE_SIZE_LINK)}>{sizeLabel}</a>;
  }, [ pageSize, setPageSize ]);

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
          <div>
            <Localizer>
              <a className={getElementClassNames(SORT_LINK)}
                 onClick={setNextSortType}
                 title={
                   <Text id={SORT_TYPES[nextSortType].actionLabelId}>
                     {SORT_TYPES[nextSortType].defaultActionLabel}
                   </Text>
                 }>
                <Text id={SORT_TYPES[sortType].labelId}>
                  {SORT_TYPES[sortType].defaultLabel}
                </Text>
              </a>
              <a className={getElementClassNames(SORT_LINK)}
                 onClick={setNextSortDirection}
                 title={
                   <Text id={SORT_DIRECTIONS[nextSortDirection].actionLabelId}>
                     {SORT_DIRECTIONS[nextSortDirection].defaultActionLabel}
                   </Text>
                 }>
                <span className={getElementClassNames(DIRECTION_LABEL)}>
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
            />)}
          <div className={getElementClassNames(PAGINATION_FOOTER)}>
            <div className={getElementClassNames(PAGINATION_STATE)}>
              {firstIndex} - {lastIndex} / {solutions.length}
            </div>
            <div className={getElementClassNames(PAGINATION_SIZES)}>
              (<Text id="per_page">per page:</Text> {PAGE_SIZES.map(renderSizeLink)})
            </div>
          </div>
        </div>
      </div>
    </IntlProvider>
  );
};

export default SolutionList;
