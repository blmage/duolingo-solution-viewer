import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import lodash from 'lodash';
import { BASE, useLocalStorageList, useStyles } from './base';
import Pagination from './Pagination';
import { invertComparison } from '../functions';
import * as solution from '../functions';

const TITLE = 'title';
const TITLE_TEXT = 'title_text';
const LINK = 'link';
const SORT_LINK = 'sort_link';
const SOLUTION = 'solution';
const PAGINATION = 'pagination';

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
    [LINK]: [ '_2rA41' ],
    [PAGINATION]: [ '_1qa4z' ],
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
    [LINK]: {
      fontSize: '0.7em',
      marginRight: '0.5em',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      userSelect: 'none',
    },
    [SORT_LINK]: {
      fontSize: '1.2em',
      fontWeight: '900',
    },
    [SOLUTION]: {
      padding: '0.4em 0.5em 0.3em',
      ':nth-child(odd)': {
        background: 'rgba(0, 0, 0, 0.125)',
      },
    },
    [PAGINATION]: {
      position: 'sticky',
      bottom: '0',
      paddingTop: '0.1em',
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

/**
 * The maximum number of solutions to display on a single page.
 * @type {number}
 */
const PAGE_SIZE = 20;

const SolutionList = ({ solutions = [] }) => {
  if (0 === solutions.length) {
    return null;
  }

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS);

  const [ page, setPage ] = useState(1);

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
    setSolutionItems(
      sortedSolutions
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .map(renderSolutionItem)
    );
  }, [ sortedSolutions, sortType, sortDirection, page ]);

  return (
    <IntlProvider scope="solution.list">
      <div>
        <h3 className={getElementClassNames(TITLE)}>
          <span className={getElementClassNames(TITLE_TEXT)}>
            <Text id="correct_solutions">Correct solutions:</Text>
          </span>
          <div>
            <Localizer>
              <a className={getElementClassNames(LINK)}
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
              <a className={getElementClassNames(LINK)}
                 onClick={setNextSortDirection}
                 title={
                   <Text id={SORT_DIRECTIONS[nextSortDirection].actionLabelId}>
                     {SORT_DIRECTIONS[nextSortDirection].defaultActionLabel}
                   </Text>
                 }>
                <span className={getElementClassNames(SORT_LINK)}>
                  {SORT_DIRECTIONS[sortDirection].label}
                </span>
              </a>
            </Localizer>
          </div>
        </h3>
        <ul>{solutionItems}</ul>
        {(solutions.length > PAGE_SIZE) && (
          <div className={getElementClassNames(PAGINATION)}>
            <Pagination
              activePage={page}
              itemCountPerPage={PAGE_SIZE}
              totalItemCount={solutions.length}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </IntlProvider>
  );
};

export default SolutionList;
