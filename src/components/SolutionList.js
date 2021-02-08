import { Fragment, h } from 'preact';
import { forwardRef } from 'preact/compat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStateRef } from 'preact-use';
import { IntlProvider, Localizer, Text, useText } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { _, it } from 'param.macro';
import moize from 'moize';

import {
  WORD_MATCH_ANYWHERE,
  WORD_MATCH_END,
  WORD_MATCH_EXACT,
  WORD_MATCH_NONE,
  WORD_MATCH_START,
} from '../constants';

import {
  boundIndicesOf,
  getFixedElementPositioningParent,
  getWordAt,
  identity,
  invertComparison,
  noop,
} from '../functions';

import * as Solution from '../solutions.js';

import {
  BASE,
  CONTEXT_CHALLENGE,
  CONTEXT_FORUM,
  useLocalStorage,
  useLocalStorageList,
  useStyles,
} from './index';

import Dropdown from './Dropdown';
import Pagination from './Pagination';
import WordFilterInput from './WordFilterInput';

const SORT_TYPE_SIMILARITY = 'similarity';
const SORT_TYPE_ALPHABETICAL = 'alphabetical';

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
 * @type {Function}
 * @param {boolean} isScoreAvailable Whether similarity scores are available on solutions.
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

/**
 * @type {Function}
 * @param {number|string} sizeA A page size.
 * @param {number|string} sizeB Another page size.
 * @returns {boolean} Whether the two page sizes are equivalent.
 */
const isEqualPageSizes = (sizeA, sizeB) => String(sizeA) === String(sizeB);

const ListSortLinks =
  ({
     context,
     availableSortTypes,
     sortType,
     nextSortType,
     sortDirection,
     nextSortDirection,
     onSortTypeToggle,
     onSortDirectionToggle,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const {
      sortTypeLabel,
      nextSortTypeTitle,
      nextSortDirectionTitle,
    } = useText({
      sortTypeLabel: (
        <Text id={SORT_TYPES[sortType].labelId}>
          {SORT_TYPES[sortType].defaultLabel}
        </Text>
      ),
      nextSortTypeTitle: (
        <Text id={SORT_TYPES[nextSortType].actionLabelId}>
          {SORT_TYPES[nextSortType].defaultActionLabel}
        </Text>
      ),
      nextSortDirectionTitle: (
        <Text id={SORT_DIRECTIONS[nextSortDirection].actionLabelId}>
          {SORT_DIRECTIONS[nextSortDirection].defaultActionLabel}
        </Text>
      ),
    });

    return (
      <div className={getElementClassNames(TITLE_LINK_WRAPPER)}>
        <Localizer>
          {(1 === availableSortTypes.length)
            ? ( // Single sort type
              <span className={getElementClassNames([ SORT_TYPE_LABEL, SINGLE_SORT_TYPE_LABEL ])}>
                {sortTypeLabel}
              </span>
            ) : ( // Multiple sort types
              <a
                title={nextSortTypeTitle}
                onClick={onSortTypeToggle}
                className={getElementClassNames(SORT_LINK)}
              >
                <span className={getElementClassNames(SORT_TYPE_LABEL)}>
                  {sortTypeLabel}
                </span>
              </a>
            )}

          <a
            title={nextSortDirectionTitle}
            onClick={onSortDirectionToggle}
            className={getElementClassNames(SORT_LINK)}
          >
            <span className={getElementClassNames(SORT_DIRECTION_LABEL)}>
              {SORT_DIRECTIONS[sortDirection].label}
            </span>
          </a>
        </Localizer>
      </div>
    );
  };

const WORD_ACTION_INCLUDE = 'include';
const WORD_ACTION_EXCLUDE = 'exclude';

const SelectedWordActions =
  ({
     context,
     bbox,
     word,
     onAddFilter = noop,
   }) => {
    const [ isMenuDisplayed, setIsMenuDisplayed ] = useState(true);

    const onCloseMenu = () => setIsMenuDisplayed(false);

    const onSelect = action => {
      onCloseMenu();

      onAddFilter({
        word,
        matchMode: WORD_MATCH_EXACT,
        isExcluded: WORD_ACTION_EXCLUDE === action,
      })
    };

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const actions = [
      {
        action: WORD_ACTION_INCLUDE,
        icon: 'check',
        labelId: 'view_list_with_word',
        defaultLabel: `View solutions with "${word}"`,
        labelFields: { word },
      },
      {
        action: WORD_ACTION_EXCLUDE,
        icon: 'times',
        labelId: 'view_list_without_word',
        defaultLabel: `View solutions without "${word}"`,
        labelFields: { word },
      },
    ];

    if (!isMenuDisplayed) {
      return;
    }

    return (<div style={bbox} className={getElementClassNames(SELECTED_WORD_ACTIONS)}>
        <Dropdown
          context={context}
          options={actions}
          getOptionKey={({ action }) => action}
          onSelect={onSelect}
          onClose={onCloseMenu}
        />
      </div>
    );
  };

const ListPagination =
  ({
     context,
     solutionCount,
     page,
     pageSize,
     onPageChange,
     onPageSizeChange,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const getSizeLabel = size => (PAGE_SIZE_ALL !== size)
      ? `${size}`
      : <Text id="all">all</Text>;

    const renderSizeLink = useCallback(size => (
      isEqualPageSizes(size, pageSize)
        ? ( // Same page size
          <span className={getElementClassNames(CURRENT_PAGE_SIZE)}>
            {getSizeLabel(size)}
          </span>
        ) : ( // Different page size
          <a onClick={() => onPageSizeChange(size)} className={getElementClassNames(PAGE_SIZE_LINK)}>
            {getSizeLabel(size)}
          </a>
        )
    ), [ pageSize, onPageSizeChange, getElementClassNames ]);

    const renderSizeOption = useCallback(size => (
      <option
        value={size}
        selected={isEqualPageSizes(size, pageSize)}
        className={getElementClassNames(PAGE_SIZE_OPTION)}
      >
        {getSizeLabel(size)}
      </option>
    ), [ pageSize, getElementClassNames ]);

    const [ firstIndex, lastIndex ] = (PAGE_SIZE_ALL === pageSize)
      ? [ 1, solutionCount ]
      : [ (page - 1) * pageSize + 1, Math.min(solutionCount, page * pageSize) ];

    return (
      <div className={getElementClassNames(PAGINATION_WRAPPER)}>
        {(PAGE_SIZE_ALL !== pageSize) && (
          <Pagination
            activePage={page}
            itemCountPerPage={pageSize}
            totalItemCount={solutionCount}
            onPageChange={onPageChange}
            context={context}
          />
        )}

        <div className={getElementClassNames(PAGINATION_FOOTER)}>
          <div className={getElementClassNames(PAGINATION_STATE)}>
            {firstIndex} - {lastIndex} / {solutionCount}
          </div>

          <div className={getElementClassNames(PAGINATION_SIZE_WRAPPER)}>
            <Text id="per_page">per page:</Text>

            {PAGE_SIZES.map(renderSizeLink)}

            <div className={getElementClassNames(PAGE_SIZE_SELECT_WRAPPER)}>
              <select
                onChange={event => onPageSizeChange(event.target.value)}
                className={getElementClassNames(PAGE_SIZE_SELECT)}
              >
                {PAGE_SIZES.map(renderSizeOption)}
              </select>
            </div>
          </div>
        </div>
      </div>
    )
  };

const SolutionList =
  forwardRef(
    (
      {
        context = CONTEXT_CHALLENGE,
        solutions = [],
        matchingData = {},
        onPageChange = noop,
      },
      listRef
    ) => {
      const isScoreAvailable = useMemo(() => {
        return solutions.some('score' in it);
      }, [ solutions ]);

      const sortTypes = getAvailableSortTypes(isScoreAvailable);

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

      // 1. Sort the solutions.

      const sortedSolutions = useMemo(() => (
        solutions.slice()
          .sort(
            SORT_TYPE_SIMILARITY === sortType
              ? (SORT_DIRECTION_ASC === sortDirection ? invertComparison : identity)(Solution.compareByScore)
              : (SORT_DIRECTION_ASC === sortDirection ? identity : invertComparison)(Solution.compareByReference)
          )
      ), [ solutions, sortType, sortDirection ]);

      // 2. Filter the solutions.

      const filterCache = useRef({}).current;
      const [ filters, filtersRef, setFilters ] = useStateRef([]);

      const filteredSolutions = useMemo(() => {
        for (const filter of filters) {
          if (!filterCache[filter.word]) {
            filterCache[filter.word] = {};
          }
        }

        return sortedSolutions.filter(({ matchingData: { id, words } }) => {
          for (const filter of filters) {
            let start = 0;
            let matches = WORD_MATCH_NONE;
            let isMatched = false;

            if (filterCache[filter.word][id]) {
              [ start, matches ] = filterCache[filter.word][id];
              isMatched = (filter.matchMode & matches) === filter.matchMode;
            }

            let index = start;

            while ((index < words.length) && !isMatched) {
              const word = words[index];
              const [ first, last ] = boundIndicesOf(word, filter.word);

              if (first >= 0) {
                if (first === 0) {
                  if (last + filter.word.length === word.length) {
                    matches = WORD_MATCH_EXACT;
                    index = words.length;
                  } else {
                    matches |= WORD_MATCH_START;
                  }
                } else if (last + filter.word.length === word.length) {
                  matches |= WORD_MATCH_END;
                } else if (first + last >= 0) {
                  matches |= WORD_MATCH_ANYWHERE;
                }
              }

              ++index;
              isMatched = (filter.matchMode & matches) === filter.matchMode;
            }

            if (index > start) {
              filterCache[filter.word][id] = [ index, matches ];
            }

            if (isMatched === filter.isExcluded) {
              return false;
            }
          }

          return true;
        })
      }, [ sortedSolutions, filterCache, filters ]);

      // 3. Paginate and render the current solutions.

      const [ rawPage, setRawPage ] = useState(1);
      const shouldTriggerPageChange = useRef(false);
      const [ pageSize, setRawPageSize ] = useLocalStorage('page_size', DEFAULT_PAGE_SIZE);

      const page = (PAGE_SIZE_ALL === pageSize)
        ? 1
        : Math.min(rawPage, Math.ceil(filteredSolutions.length / pageSize));

      const setPage = useCallback(page => {
        setRawPage(page);
        shouldTriggerPageChange.current = true;
      }, [ setRawPage ]);

      const setPageSize = useCallback(size => {
        setRawPageSize(size);

        if (PAGE_SIZE_ALL === size) {
          setRawPage(1);
        } else {
          // Update the current page to keep the same solution at the top of the list.
          const sizeValue = Number(size);

          if (PAGE_SIZES.indexOf(sizeValue) === -1) {
            return;
          }

          const oldSize = (PAGE_SIZE_ALL === pageSize)
            ? filteredSolutions.length
            : Math.min(pageSize, filteredSolutions.length);

          setRawPage(Math.ceil(((page - 1) * oldSize + 1) / sizeValue));
        }

        shouldTriggerPageChange.current = true;
      }, [ page, pageSize, filteredSolutions.length, setRawPageSize ]);

      const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

      const solutionItems = useMemo(() => {
        const renderSolutionItem = solution => (
          <li className={getElementClassNames(SOLUTION)}>
            {Solution.getReaderFriendlySummary(solution)}
          </li>
        );

        const pageSolutions = (PAGE_SIZE_ALL === pageSize)
          ? filteredSolutions
          : filteredSolutions.slice((page - 1) * pageSize, page * pageSize);

        return pageSolutions.map(renderSolutionItem);
      }, [ page, pageSize, filteredSolutions, getElementClassNames ]);

      // Triggers the "page change" callback asynchronously,
      // to make sure it is run only when the changes have been applied to the UI.
      useEffect(() => {
        if (shouldTriggerPageChange.current) {
          setTimeout(onPageChange());
          shouldTriggerPageChange.current = false;
        }
      }, [ solutionItems, onPageChange, shouldTriggerPageChange ]);

      // Detects word selections, and proposes new filter options when relevant.
      const [ selectedWord, setSelectedWord ] = useState(null);

      useEffect(() => {
        // Detect when the left button is released to only propose suggestions when a selection has been committed.
        const onMouseUp = event => {
          if (listRef.current && (event.button === 0)) {
            const selection = document.getSelection();

            if (
              selection.anchorNode
              && (selection.anchorNode === selection.focusNode)
              && listRef.current.contains(selection.anchorNode)
              && (selection.anchorNode.parentNode.nodeName === 'LI')
            ) {
              // We are only interested in single-word selections.
              const words = Solution.getStringMatchableWords(
                selection.toString().trim(),
                matchingData.locale,
                matchingData.matchingOptions
              );

              if (1 === words.length) {
                const [ word = '' ] = Solution.getStringMatchableWords(
                  getWordAt(
                    selection.anchorNode.wholeText,
                    Math.floor((selection.anchorOffset + selection.focusOffset) / 2)
                  ),
                  matchingData.locale,
                  matchingData.matchingOptions
                );

                if ((word.length > 1) && !(filtersRef.current || []).some(it.word === word)) {
                  const bbox = selection.getRangeAt(0).getBoundingClientRect();
                  const offsetParent = getFixedElementPositioningParent(listRef.current);

                  if (offsetParent) {
                    const parentBbox = offsetParent.getBoundingClientRect();
                    bbox.x -= parentBbox.x;
                    bbox.y -= parentBbox.y;
                  }

                  setSelectedWord({
                    word,
                    bbox: {
                      left: `${Math.floor(bbox.x)}px`,
                      top: `${Math.floor(bbox.y)}px`,
                      width: `${Math.ceil(bbox.width)}px`,
                      height: `${Math.ceil(bbox.height)}px`,
                    },
                  });

                  return;
                }
              }
            }
          }

          // Delay hiding the actions dropdown to let "click" events be triggered normally.
          setTimeout(() => setSelectedWord(null));
        };

        // Detect change events to ensure that suggestions are hidden when the selection is canceled.
        const onSelectionChange = () => {
          const selection = document.getSelection();

          if (!selection || ('None' === selection.type)) {
            setSelectedWord(null);
          }
        };

        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('selectionchange', onSelectionChange);

        return () => {
          document.removeEventListener('mouseup', onMouseUp);
          document.removeEventListener('selectionchange', onSelectionChange);
        }
      });

      if (0 === solutions.length) {
        return null;
      }

      return (
        <IntlProvider scope="solution_list">
          <div>
            <h3 className={getElementClassNames(TITLE)}>
            <span className={getElementClassNames(TITLE_TEXT)}>
              <Text id="filter">Filter:</Text>
            </span>

              <WordFilterInput
                context={context}
                filters={filters}
                matchingData={matchingData}
                onChange={setFilters}
              />
            </h3>

            <div ref={listRef}>
              <h3 className={getElementClassNames(TITLE)}>
              <span className={getElementClassNames(TITLE_TEXT)}>
                <Text id="correct_solutions">Correct solutions:</Text>
              </span>

                <ListSortLinks
                  context={context}
                  availableSortTypes={sortTypes}
                  sortType={sortType}
                  nextSortType={nextSortType}
                  sortDirection={sortDirection}
                  nextSortDirection={nextSortDirection}
                  onSortTypeToggle={() => setNextSortType()}
                  onSortDirectionToggle={() => setNextSortDirection()}
                />
              </h3>

              {(0 === filteredSolutions.length)
                ? (
                  <div>
                    <Text id="no_matching_solution">There is no matching solution.</Text>
                  </div>
                ) : (
                  <Fragment>
                    <ul>{solutionItems}</ul>

                    {selectedWord && (
                      <SelectedWordActions
                        {...selectedWord}
                        context={context}
                        onAddFilter={setFilters([ ...filters, _ ])}
                      />
                    )}

                    <ListPagination
                      context={context}
                      solutionCount={filteredSolutions.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </Fragment>
                )}
            </div>
          </div>
        </IntlProvider>
      );
    }
  );

export default SolutionList;

const TITLE = 'title';
const TITLE_TEXT = 'title_text';
const TITLE_LINK_WRAPPER = 'title_link_wrapper';
const SORT_LINK = 'sort_link';
const SORT_TYPE_LABEL = 'sort_type_label';
const SORT_DIRECTION_LABEL = 'sort_direction_label';
const SINGLE_SORT_TYPE_LABEL = 'single_sort_type_label';
const SOLUTION = 'solution';
const SELECTED_WORD_ACTIONS = 'selected_word_actions';
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
    // Found in the "app" stylesheet. Adds the main link color.
    [SORT_LINK]: [ '_2__FI' ],
    // Found in the "app" stylesheet. Adds the page background color.
    [PAGINATION_WRAPPER]: [ '_3lUbm' ],
    [PAGE_SIZE_LINK]: [ '_2__FI' ],
    [PAGE_SIZE_SELECT_WRAPPER]: [ '_2__FI' ],
    [PAGE_SIZE_SELECT]: [ '_2__FI' ],
  },
  [CONTEXT_FORUM]: {
    // Copied from the (heading) wrapper of the "Translation:" subtitle and the translation.
    [TITLE_TEXT]: [ '_2qRu2' ],
    // Copied from the "Reply" links. Only the class name which adds the color is used here.
    [SINGLE_SORT_TYPE_LABEL]: [ 'uFNEM' ],
    [SOLUTION]: [ '_2qRu2' ],
    // Found in the "ltr" stylesheet. Adds the main link color (unwanted styles are reset below).
    [PAGE_SIZE_SELECT_WRAPPER]: [ '_1bO3u' ],
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
      marginRight: '0.5em',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      '@media (any-pointer: coarse)': {
        display: 'inline-block',
        padding: '0.125em 1em',
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
    [SINGLE_SORT_TYPE_LABEL]: {
      fontWeight: 'normal',
      marginRight: '0.5em',
    },
    [SOLUTION]: {
      padding: '0.4em 0.5em 0.3em',
      ':nth-child(odd)': {
        background: 'rgba(0, 0, 0, 0.125)',
      },
    },
    [SELECTED_WORD_ACTIONS]: {
      position: 'fixed',
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
      padding: '0',
      position: 'relative',
      // Fixes the display of the border with Darklingo++.
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
    [SORT_LINK]: {
      fontSize: '0.75em',
    },
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
    [TITLE_TEXT]: {
      padding: 0,
      textTransform: 'none',
    },
    [SORT_TYPE_LABEL]: {
      marginRight: '0.5em',
      textTransform: 'none',
    },
    [PAGE_SIZE_SELECT]: {
      color: 'inherit',
    },
  }),
};
