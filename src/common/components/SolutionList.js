import { Fragment, h } from 'preact';
import { forwardRef } from 'preact/compat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useClickAway, useStateRef } from 'preact-use';
import { IntlProvider, Localizer, Text, useText } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { _, _1, _2, it, lift } from 'one-liner.macro';
import moize from 'moize';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { capitalize, cartesianProduct, identity, invertComparison, noop } from 'duo-toolbox/utils/functions';

import {
  discardEvent,
  getFixedElementPositioningParent,
  scrollElementIntoParentView,
  triggerContentDownload,
} from 'duo-toolbox/utils/ui';

import {
  STRING_MATCH_MODE_GLOBAL,
  STRING_MATCH_MODE_WORDS,
  STRING_MATCH_TYPE_ANYWHERE,
  STRING_MATCH_TYPE_END,
  STRING_MATCH_TYPE_EXACT,
  STRING_MATCH_TYPE_NONE,
  STRING_MATCH_TYPE_START,
} from '../constants';

import { boundIndicesOf, getWordAt } from '../strings';
import * as Solution from '../solutions';

import { BASE, CONTEXT_CHALLENGE, useLocalStorage, useLocalStorageList, useStyles } from './index';

import Dropdown from './Dropdown';
import FilterInput from './FilterInput';
import Pagination from './Pagination';

const SORT_DIRECTION_ASC = 'asc';
const SORT_DIRECTION_DESC = 'desc';

const SORT_DIRECTIONS = {
  [SORT_DIRECTION_ASC]: {
    label: '↑',
    actionLabelKey: 'sort_ascending',
    defaultActionLabel: 'Sort in ascending order',
  },
  [SORT_DIRECTION_DESC]: {
    label: '↓',
    actionLabelKey: 'sort_descending',
    defaultActionLabel: 'Sort in descending order',
  },
};

const SORT_TYPE_SIMILARITY = 'similarity';
const SORT_TYPE_ALPHABETICAL = 'alphabetical';

const SORT_TYPES = [
  {
    type: SORT_TYPE_SIMILARITY,
    defaultDirection: SORT_DIRECTION_DESC,
    labelKey: 'similarity_sort',
    defaultLabel: 'Similarity sort',
    actionLabelKey: 'sort_by_similarity',
    defaultActionLabel: 'Sort by similarity',
    icons: {
      [SORT_DIRECTION_ASC]: [ 'fas', 'fa-sort-amount-up' ],
      [SORT_DIRECTION_DESC]: [ 'fas', 'fa-sort-amount-down' ],
    },
  },
  {
    type: SORT_TYPE_ALPHABETICAL,
    defaultDirection: SORT_DIRECTION_ASC,
    labelKey: 'alphabetical_sort',
    defaultLabel: 'Alphabetical sort',
    actionLabelKey: 'sort_alphabetically',
    defaultActionLabel: 'Sort alphabetically',
    icons: {
      [SORT_DIRECTION_ASC]: [ 'fas', 'fa-sort-alpha-up' ],
      [SORT_DIRECTION_DESC]: [ 'fas', 'fa-sort-alpha-down' ],
    },
  },
];

/**
 * @param {boolean} isScoreAvailable Whether similarity scores are available on solutions.
 * @returns {string[]} The available sort types.
 */
const getAvailableSortTypes = moize(isScoreAvailable => {
  let sortTypes = SORT_TYPES.map(it.type)

  if (!isScoreAvailable) {
    sortTypes = sortTypes.filter(SORT_TYPE_SIMILARITY !== it);
  }

  return sortTypes;
});

const PAGE_SIZE_ALL = 'all';
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [ 10, 20, 50, 200, PAGE_SIZE_ALL ];

/**
 * @type {Function}
 * @param {number|string} sizeA A page size.
 * @param {number|string} sizeB Another page size.
 * @returns {boolean} Whether the two page sizes are equivalent.
 */
const isEqualPageSizes = String(_) === String(_);

const ListFlagFilters =
  ({
     context,
     flagFilterSet,
     flagFilterMask,
     onChange,
   }) => {
    const toggleFlag = onChange(flagFilterMask ^ _);
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    return (
      <Fragment>
        <h3 className={getElementClassNames(TITLE)}>
          <span className={getElementClassNames(TITLE_TEXT)}>
            <Text id={flagFilterSet.labelKey}>{flagFilterSet.defaultLabel}</Text>

            <Localizer>
              <span
                title={<Text id={flagFilterSet.hintKey}>{flagFilterSet.defaultHint}</Text>}
                className={getElementClassNames(TITLE_HINT)}
              >
                <FontAwesomeIcon icon={[ 'fas', 'circle-question' ]} />
              </span>
            </Localizer>
          </span>
        </h3>

        <ul>
          {flagFilterSet.filters.map(filter => {
            const key = `flag-filter-${filter.flag}`;
            const isChecked = (flagFilterMask & filter.flag) > 0;

            const onClick = event => {
              discardEvent(event);
              toggleFlag(filter.flag);
            };

            return (
              <li key={key} className={getElementClassNames(FLAG_FILTER_OPTION)}>
                <input
                  key={`${key}-${isChecked ? 'checked' : 'unchecked'}`}
                  type="checkbox"
                  onClick={onClick}
                  checked={isChecked}
                  className={getElementClassNames(FLAG_FILTER_CHECKBOX)}
                />

                <label onClick={onClick}>
                  <Text id={filter.labelKey}>{filter.defaultLabel}</Text>
                  <span className={getElementClassNames(FLAG_FILTER_MATCH_COUNT)}>( {filter.matchCount} )</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Fragment>
    );
  };

const ListSortLinks =
  ({
     context,
     availableTypes,
     currentType,
     currentDirection,
     nextDirection,
     onTypeChange,
     onDirectionToggle,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const { unavailablePrefix } = useText({
      unavailablePrefix: <Text id="unavailable">Unavailable</Text>
    });

    const typeLabels = useText(Object.fromEntries(
      SORT_TYPES.map([
        it.type,
        <Text key={it.labelKey} id={it.labelKey}>{it.defaultLabel}</Text>,
      ])
    ));

    const typeActionLabels = useText(Object.fromEntries(
      SORT_TYPES.map([
        it.type,
        <Text key={it.actionLabelKey} id={it.actionLabelKey}>{it.defaultActionLabel}</Text>,
      ])
    ));

    const { nextDirectionActionLabel } = useText({
      nextDirectionActionLabel: (
        <Text key={SORT_DIRECTIONS[nextDirection].actionLabelKey}>
          {SORT_DIRECTIONS[nextDirection].defaultActionLabel}
        </Text>
      ),
    });

    return (
      <div className={getElementClassNames(LIST_ACTION_LINK_WRAPPER)}>
        {SORT_TYPES.map(({ type, icons, defaultDirection }) => {
          const isActive = (type === currentType);
          const isDisabled = !availableTypes.includes(type);
          let icon;
          let title;

          if (isActive) {
            icon = icons[currentDirection];
            title = `${typeLabels[type]} - ${nextDirectionActionLabel}`;
          } else {
            icon = icons[defaultDirection];

            if (!isDisabled) {
              title = typeActionLabels[type];
            } else {
              title = `[${unavailablePrefix}] ${typeActionLabels[type]}`;
            }
          }

          const buttonClassNames = getElementClassNames([
            LIST_ACTION_LINK,
            isDisabled && DISABLED_LIST_ACTION_LINK,
            isActive ? ACTIVE_LIST_ACTION_LINK : INACTIVE_LIST_ACTION_LINK,
          ]);

          const onClick = event => {
            discardEvent(event);

            if (isActive) {
              onDirectionToggle();
            } else {
              onTypeChange(type);

              if (currentDirection !== defaultDirection) {
                onDirectionToggle();
              }
            }
          };

          return (
            <button
              key={type}
              title={title}
              onClick={onClick}
              disabled={isDisabled}
              className={buttonClassNames}
            >
              <FontAwesomeIcon
                icon={icon}
                className={getElementClassNames(LIST_ACTION_LINK_ICON)}
              />
            </button>
          );
        })}
      </div>
    );
  };

const EXPORT_SCOPE_ALL = 'all';
const EXPORT_SCOPE_FILTERED = 'filtered';
const EXPORT_SCOPE_CURRENT_PAGE = 'current_page';
const EXPORT_SCOPES = [ EXPORT_SCOPE_ALL, EXPORT_SCOPE_FILTERED, EXPORT_SCOPE_CURRENT_PAGE ];

const EXPORT_SCOPE_ICONS = {
  [EXPORT_SCOPE_ALL]: [ 'far', 'copy' ],
  [EXPORT_SCOPE_FILTERED]: [ 'far', 'file-search' ],
  [EXPORT_SCOPE_CURRENT_PAGE]: [ 'far', 'file' ],
};

const EXPORT_TYPE_FOLDED = 'folded';
const EXPORT_TYPE_UNFOLDED = 'unfolded';
const EXPORT_TYPES = [ EXPORT_TYPE_FOLDED, EXPORT_TYPE_UNFOLDED ];

const EXPORT_OPTIONS = cartesianProduct([ EXPORT_SCOPES, EXPORT_TYPES ])
  .map(([ scope, type ]) => ({
    value: { scope, type },
    icon: EXPORT_SCOPE_ICONS[scope],
    labelId: `export_${scope}_${type}`,
    defaultLabel: `${capitalize(scope.replace('_', ' '))} (${type})`,
  }));

const EXPORT_SIZE_ALERT_THRESHOLD = 10000;

const ListExportLinks =
  ({
     context,
     baseFilename,
     allSolutions,
     filteredSolutions,
     currentPageSolutions,
   }) => {
    const menu = useRef();
    const wrapper = useRef();
    const [ isMenuDisplayed, setIsMenuDisplayed ] = useState(false);

    const { defaultBaseFilename, exportTitle, largeExportAlert } = useText({
      defaultBaseFilename: (
        <Text id="export_base_filename">solutions</Text>
      ),
      exportTitle: (
        <Text id="export">Export solutions</Text>
      ),
      largeExportAlert: (
        <Text id="large_export_alert">
          This will export a large number of rows and may take a long time or fail. Are you sure you want to proceed?
        </Text>
      )
    });

    const onCloseMenu = () => setIsMenuDisplayed(false);

    const onToggleMenu = event => {
      discardEvent(event);
      setIsMenuDisplayed(!isMenuDisplayed);
    };

    const onSelect = ({ scope, type }) => {
      onCloseMenu();

      const solutions = ({
        [EXPORT_SCOPE_ALL]: allSolutions,
        [EXPORT_SCOPE_FILTERED]: filteredSolutions,
        [EXPORT_SCOPE_CURRENT_PAGE]: currentPageSolutions,
      })[scope] ?? [];

      const isLargeExport = (
        (solutions.length > EXPORT_SIZE_ALERT_THRESHOLD)
        || (
          (EXPORT_TYPE_UNFOLDED === type)
          && (solutions.reduce((n, x) => (n + Solution.getUnfoldedSentenceCount(x)), 0) > EXPORT_SIZE_ALERT_THRESHOLD)
        )
      );

      if (isLargeExport && !confirm(largeExportAlert)) {
        return;
      }

      const result = (EXPORT_TYPE_FOLDED === type)
        ? solutions.map(lift(Solution.getReaderFriendlySummary(_)))
        : solutions.flatMap(lift(Solution.getUnfoldedSentences(_)));

      triggerContentDownload(
        result.map(`"${it}"`).join('\n'),
        'application/csv',
        `${baseFilename || defaultBaseFilename}.csv`
      );
    };

    useClickAway([ wrapper, menu ], onCloseMenu);

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    return (
      <div ref={wrapper} className={getElementClassNames(LIST_ACTION_LINK_WRAPPER)}>
        <div
          title={exportTitle}
          onClick={onToggleMenu}
          className={getElementClassNames([ LIST_ACTION_LINK, INACTIVE_LIST_ACTION_LINK ])}
        >
          <FontAwesomeIcon
            icon="fa-file-csv"
            className={getElementClassNames(LIST_ACTION_LINK_ICON)}
          />

          {isMenuDisplayed && (
            <div>
              <Dropdown
                ref={menu}
                context={context}
                options={EXPORT_OPTIONS}
                getOptionKey={({ value }) => value}
                onSelect={onSelect}
                onClose={onCloseMenu}
              />
            </div>
          )}
        </div>
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
     matchType = STRING_MATCH_TYPE_EXACT,
     onAddFilter = noop,
   }) => {
    const [ isMenuDisplayed, setIsMenuDisplayed ] = useState(true);

    const onCloseMenu = () => setIsMenuDisplayed(false);

    const onSelect = action => {
      onCloseMenu();

      onAddFilter({
        word,
        matchType,
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

/**
 * @type {Function}
 * @param {number} matchType A match type.
 * @param {number} matches A set of match results.
 * @returns {boolean} Whether the given results include a match of the given type.
 */
const testMatches = (_1 & _2) === _1;

/**
 * @param {string} string A string.
 * @param {string} substring The substring to search in the given string.
 * @returns {number} A set of match results corresponding to the positions of the substring in the string.
 */
const matchSubstring = (string, substring) => {
  let match = STRING_MATCH_TYPE_NONE;
  const [ first, last ] = boundIndicesOf(string, substring);

  if (first >= 0) {
    if (first === 0) {
      if (last + substring.length === string.length) {
        match = STRING_MATCH_TYPE_EXACT;
      } else {
        match = STRING_MATCH_TYPE_START;
      }
    } else if (last + substring.length === string.length) {
      match = STRING_MATCH_TYPE_END;
    } else if (first + last >= 0) {
      match = STRING_MATCH_TYPE_ANYWHERE;
    }
  }

  return match;
};

/**
 * @param {import('../solutions.js').Solution} solution A solution.
 * @param {number} mask A mask for testing flag filters.
 * @returns {boolean} Whether the given solution matches any of the flags tested by the given mask.
 */
const isSolutionMatchingFlagFilterMask = (solution, mask) => ((solution.flags ?? 0) & mask) > 0;

/**
 * @typedef {object} MatchResult The result of a match between a solution against a filter.
 * @property {boolean} isMatched Whether the solution matched the filter.
 * @property {number} matches A set of match results corresponding to the positions of the filter in the solution.
 * @property {boolean} isPartial Whether the results may still be refined.
 * @property {*} state If the results may be refined, a state indicating where to pick up next.
 */

/**
 * @param {import('../solutions.js').Solution} solution A solution.
 * @param {import('./FilterInput.js').WordFilter} filter A filter.
 * @param {number} matches A set of previous match results.
 * @param {number} index The index of the first word of the solution to match against the filter.
 * @returns {MatchResult} The result of the match between the given solution and filter.
 */
const matchSolutionOnWords = (solution, filter, matches, index = 0) => {
  const words = solution.matchingData.words;
  let isMatched;
  let isPartial;

  do {
    matches |= matchSubstring(words[index], filter.word);
    index = (STRING_MATCH_TYPE_EXACT === matches) ? words.length : index + 1;
    isPartial = (index < words.length);
    isMatched = testMatches(filter.matchType, matches);
  } while (!isMatched && isPartial);

  return {
    isMatched,
    matches,
    isPartial,
    state: index,
  };
};

/**
 * @param {import('../solutions.js').Solution} solution A solution.
 * @param {import('./FilterInput.js').WordFilter} filter A filter.
 * @returns {MatchResult} The result of the match between the given solution and filter.
 */
const matchSolutionOnSummary = (solution, filter) => {
  const matches = matchSubstring(solution.matchingData.summary, filter.word);

  return {
    isMatched: testMatches(filter.matchType, matches),
    matches,
    isPartial: false,
  }
};

/**
 * @param {Function} matchSolution The callback usable to match a solution against a filter.
 * @param {import('../solutions.js').Solution[]} solutions A list of solutions.
 * @param {import('./FilterInput.js').WordFilter[]} filters A list of filters.
 * @param {number|null} flagFilterMask A mask of the flag filters that should be matched by the solutions.
 * @param {object} filterCache A cache for the results of filters.
 * @returns {import('../solutions.js').Solution[]} A sub-list of the solutions that matched the given filters.
 */
const filterSolutions = (matchSolution, solutions, filters, flagFilterMask, filterCache) => {
  for (const filter of filters) {
    if (!filterCache[filter.word]) {
      filterCache[filter.word] = {};
    }
  }

  return solutions.filter(solution => {
    if ((null !== flagFilterMask) && !isSolutionMatchingFlagFilterMask(solution, flagFilterMask)) {
      return false;
    }

    const id = solution.matchingData.id;

    for (const filter of filters) {
      const word = filter.word;
      let cache;
      let isMatched;

      if (filterCache[word][id]) {
        cache = filterCache[word][id];
        isMatched = testMatches(filter.matchType, cache.matches);
      } else {
        cache = { matches: STRING_MATCH_TYPE_NONE, isPartial: true };
        isMatched = false;
      }

      if (!isMatched && cache.isPartial) {
        ({ isMatched, ...cache } = matchSolution(solution, filter, cache.matches, cache.state));
        filterCache[word][id] = cache;
      }

      if (isMatched === filter.isExcluded) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Filters a list of solutions based on the words they contain.
 * @type {Function}
 * @param {import('../solutions.js').Solution[]} solutions A list of solutions.
 * @param {import('./FilterInput.js').WordFilter[]} filters A list of filters.
 * @param {object} filterCache A cache for the results of filters.
 * @returns {import('../solutions.js').Solution[]} A sub-list of the solutions that matched the given filters.
 */
const filterSolutionsUsingWords = filterSolutions(matchSolutionOnWords, _, _, _, _);

/**
 * Filters a list of solutions based on their summaries.
 * @type {Function}
 * @param {import('../solutions.js').Solution[]} solutions A list of solutions.
 * @param {import('./FilterInput.js').WordFilter[]} filters A list of filters.
 * @param {object} filterCache A cache for the results of filters.
 * @returns {import('../solutions.js').Solution[]} A sub-list of the solutions that matched the given filters.
 */
const filterSolutionsUsingSummaries = filterSolutions(matchSolutionOnSummary, _, _, _, _);

const SolutionList =
  forwardRef(
    (
      {
        context = CONTEXT_CHALLENGE,
        statement,
        solutions = [],
        matchingData = {},
        onPageChange = noop,
        scrollOffsetGetter = (() => 0),
      },
      listRef
    ) => {
      const locale = solutions[0]?.locale;

      const isScoreAvailable = useMemo(() => {
        return solutions.some('score' in it);
      }, [ solutions ]);

      const sortTypes = getAvailableSortTypes(isScoreAvailable);
      const [ sortType, setSortType ] = useLocalStorage('sort-type', sortTypes[0]);

      const {
        state: sortDirection,
        nextState: nextSortDirection,
        next: setNextSortDirection,
      } = useLocalStorageList(
        'sort-direction',
        Object.keys(SORT_DIRECTIONS),
        SORT_DIRECTION_DESC
      );

      const isFilterWordBased = !!matchingData.words;

      const baseExportFilename = useMemo(() => (
        statement
          .toLocaleLowerCase(locale)
          .replace(/[^\p{L}\p{N}]+/ug, '_')
          .replaceAll(/(^_+)|(_+$)/g, '')
      ), [ statement, locale ]);

      // Sort the solutions.

      const sortedSolutions = useMemo(() => (
        solutions.slice()
          .sort(
            SORT_TYPE_SIMILARITY === sortType
              ? (SORT_DIRECTION_ASC === sortDirection ? invertComparison : identity)(Solution.compareByScore)
              : (SORT_DIRECTION_ASC === sortDirection ? identity : invertComparison)(Solution.compareByReference)
          )
      ), [ solutions, sortType, sortDirection ]);

      // Filter the solutions.

      const [ flagFilterSet, defaultFlagFilterMask ] = useMemo(() => {
        const set = Solution.LOCALE_FLAG_FILTER_SETS[locale];

        if (set) {
          const flagFilterMatchCounts = Object.fromEntries(set.filters.map([ it.flag, 0 ]));

          for (const { flag } of set.filters) {
            for (const solution of solutions) {
              if (isSolutionMatchingFlagFilterMask(solution, flag)) {
                flagFilterMatchCounts[flag]++;
              }
            }
          }

          const applicableFilters = [];

          for (const filter of set.filters) {
            if (flagFilterMatchCounts[filter.flag] > 0) {
              applicableFilters.push({
                ...filter,
                matchCount: flagFilterMatchCounts[filter.flag],
              });
            }
          }

          if (applicableFilters.length > 1) {
            const defaultFilters = applicableFilters.filter(it.default);

            return [
              { ...set, filters: applicableFilters },
              ((defaultFilters.length > 0) ? defaultFilters : [ applicableFilters[0] ]).reduce(lift(_ | _.flag), 0),
            ];
          }
        }

        return [ null, null ];
      }, [ locale, solutions ]);

      const filterCache = useRef({}).current;
      const [ filters, filtersRef, setFilters ] = useStateRef([]);
      const [ flagFilterMask, setFlagFilterMask ] = useState(defaultFlagFilterMask);

      const filteredSolutions = useMemo(
        () => (
          isFilterWordBased
            ? filterSolutionsUsingWords
            : filterSolutionsUsingSummaries
        )(sortedSolutions, filters, flagFilterMask, filterCache),
        [ sortedSolutions, filters, flagFilterMask, filterCache, isFilterWordBased ]
      );

      // Paginate and render the current solutions.

      const [ rawPage, setRawPage ] = useState(1);
      const shouldTriggerPageChange = useRef(false);
      const [ pageSize, setRawPageSize ] = useLocalStorage('page_size', DEFAULT_PAGE_SIZE);

      const page = (PAGE_SIZE_ALL === pageSize)
        ? 1
        : Math.min(rawPage, Math.ceil(filteredSolutions.length / pageSize));

      const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

      const pageSolutions = useMemo(() => (
        (PAGE_SIZE_ALL === pageSize)
          ? filteredSolutions
          : filteredSolutions.slice((page - 1) * pageSize, page * pageSize)
      ), [ page, pageSize, filteredSolutions ]);

      const solutionItems = useMemo(() => {
        const baseItemKey = `${page}-${pageSize}`;
        const renderTokenSeparator = lift(<span className={getElementClassNames(SOLUTION_TOKEN_SEPARATOR)}>{_}</span>);

        const renderSolutionItem = (solution, index) => (
          <li key={`${baseItemKey}-${index}`} className={getElementClassNames(SOLUTION)}>
            {Solution.getReaderFriendlySummaryTokens(
              solution,
              {
                choiceLeftDelimiter: renderTokenSeparator('['),
                choiceSeparator: renderTokenSeparator(' / '),
                choiceRightDelimiter: renderTokenSeparator(']'),
              }
            )}
          </li>
        );

        return pageSolutions.map(renderSolutionItem);
      }, [ page, pageSize, pageSolutions, getElementClassNames ]);

      // Handle events.

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

          if (!PAGE_SIZES.includes(sizeValue)) {
            return;
          }

          const oldSize = (PAGE_SIZE_ALL === pageSize)
            ? filteredSolutions.length
            : Math.min(pageSize, filteredSolutions.length);

          setRawPage(Math.ceil(((page - 1) * oldSize + 1) / sizeValue));
        }

        shouldTriggerPageChange.current = true;
      }, [ page, pageSize, filteredSolutions.length, setRawPageSize ]);

      // Triggers the "page change" callback asynchronously,
      // to make sure it is run only when the changes have been applied to the UI.
      useEffect(() => {
        if (shouldTriggerPageChange.current) {
          setTimeout(onPageChange());
          shouldTriggerPageChange.current = false;
        }
      }, [ solutionItems, onPageChange, shouldTriggerPageChange ]);

      const filterWrapperRef = useRef();

      // Scrolls the filter input into view when it is focused.
      const onFilterFocus = useCallback(() => {
        filterWrapperRef.current
        && scrollElementIntoParentView(filterWrapperRef.current, scrollOffsetGetter(), 'smooth');
      }, [ scrollOffsetGetter, filterWrapperRef ]);

      // Focuses the solution list when the filter input loses focus, to ensure that the list is scrollable again.
      const onFilterBlur = useCallback(() => listRef.current?.closest('[tabindex]')?.focus(), [ listRef ]);

      // Detects selected words, and proposes new filter options when relevant.
      const [ selectedWord, setSelectedWord ] = useState(null);

      useEffect(() => {
        // Detect when the left button is released to only propose suggestions when a selection has been "committed".
        const onMouseUp = event => {
          if (listRef.current && (event.button === 0)) {
            const selection = document.getSelection();
            const parentItem = selection.anchorNode?.parentElement?.closest('li');

            if (parentItem && selection.focusNode && listRef.current.contains(parentItem)) {
              // We are only interested in single-word selections.
              const words = Solution.getStringMatchableWords(
                selection.toString().trim(),
                matchingData.locale,
                matchingData.matchingOptions
              );

              if (1 === words.length) {
                let selectedText = '';

                if (!isFilterWordBased) {
                  selectedText = selection.toString();
                } else {
                  let node = selection.anchorNode;
                  let firstNode = node;
                  let lastNode = selection.focusNode;

                  const range = document.createRange();
                  range.setStart(firstNode, selection.anchorOffset);
                  range.setEnd(lastNode, selection.focusOffset);

                  let [ nextNode, startOffset, endOffset, concat ] = !range.collapsed
                    ? [
                      lift(_.nextSibling),
                      selection.anchorOffset,
                      selection.focusOffset,
                      lift(_ + _),
                    ] : [
                      lift(_.previousSibling),
                      selection.focusOffset,
                      selection.anchorOffset,
                      lift(_2 + _1),
                    ];

                  while (node && !node.isSameNode(parentItem)) {
                    const isLastNode = lastNode.isSameNode(node) || node.contains(lastNode);
                    selectedText = concat(selectedText, node.textContent);

                    if (!isLastNode || range.collapsed) {
                      endOffset += node.textContent.length;
                    }

                    if (!isLastNode) {
                      node = nextNode(node) || nextNode(node.parentNode);
                    } else {
                      node = null;
                    }
                  }

                  const wordAt = selectedText
                    .substring(startOffset, Math.max(endOffset, startOffset + 1))
                    .match(/[\p{L}\p{N}]/u);

                  selectedText = wordAt ? getWordAt(selectedText, startOffset + wordAt.index) : '';
                }

                const [ word = '' ] = Solution.getStringMatchableWords(
                  selectedText,
                  matchingData.locale,
                  matchingData.matchingOptions
                );

                if (
                  (!isFilterWordBased || (word.length > 1))
                  && !(filtersRef.current || []).some(it.word === word)
                ) {
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
            <h3 ref={filterWrapperRef} className={getElementClassNames(TITLE)}>
              <span className={getElementClassNames(TITLE_TEXT)}>
                <Text id="filter">Filter:</Text>
              </span>
            </h3>

            <div>
              <FilterInput
                context={context}
                matchMode={isFilterWordBased ? STRING_MATCH_MODE_WORDS : STRING_MATCH_MODE_GLOBAL}
                matchingData={matchingData}
                minQueryLength={isFilterWordBased ? 2 : 1}
                filters={filters}
                onChange={setFilters}
                onFocus={onFilterFocus}
                onBlur={onFilterBlur}
              />
            </div>

            {flagFilterSet && (
              <ListFlagFilters
                flagFilterSet={flagFilterSet}
                flagFilterMask={flagFilterMask}
                onChange={setFlagFilterMask}
              />
            )}

            <div ref={listRef}>
              <h3 className={getElementClassNames(TITLE)}>
                <span className={getElementClassNames(TITLE_TEXT)}>
                  <Text id="correct_solutions">Correct solutions:</Text>
                </span>

                <ListSortLinks
                  context={context}
                  availableTypes={sortTypes}
                  currentType={sortType}
                  currentDirection={sortDirection}
                  nextDirection={nextSortDirection}
                  onTypeChange={setSortType}
                  onDirectionToggle={() => setNextSortDirection()}
                />

                <ListExportLinks
                  context={context}
                  baseFilename={baseExportFilename}
                  allSolutions={sortedSolutions}
                  filteredSolutions={filteredSolutions}
                  currentPageSolutions={pageSolutions}
                />
              </h3>

              {(0 === filteredSolutions.length)
                ? (
                  <div className={getElementClassNames(EMPTY_LIST)}>
                    <Text id="no_matching_solution">There is no matching solution.</Text>
                  </div>
                ) : (
                  <Fragment>
                    <ul>{solutionItems}</ul>

                    {selectedWord && (
                      <SelectedWordActions
                        {...selectedWord}
                        context={context}
                        matchType={isFilterWordBased ? STRING_MATCH_TYPE_EXACT : STRING_MATCH_TYPE_ANYWHERE}
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
const TITLE_HINT = 'title_help';
const TITLE_LINK_WRAPPER = 'title_link_wrapper';
const FLAG_FILTER_OPTION = 'flag_filter_option'
const FLAG_FILTER_CHECKBOX = 'flag_filter_checkbox'
const FLAG_FILTER_MATCH_COUNT = 'flag_filter_match_count';
const LIST_ACTION_LINK_WRAPPER = 'list_action_link_wrapper';
const LIST_ACTION_LINK = 'list_action_link';
const ACTIVE_LIST_ACTION_LINK = 'active_list_action_link';
const INACTIVE_LIST_ACTION_LINK = 'inactive_list_action_link';
const DISABLED_LIST_ACTION_LINK = 'disabled_list_action_link';
const LIST_ACTION_LINK_ICON = 'list_action_link_icon';
const EMPTY_LIST = 'empty_list';
const SOLUTION = 'solution';
const SOLUTION_TOKEN_SEPARATOR = 'solution_token_separator';
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
    // Copied from the closing button of the "Report" modal. Unwanted styles are reset below.
    [LIST_ACTION_LINK]: [ 'eJbBB', 'rXoiv' ],
    [ACTIVE_LIST_ACTION_LINK]: [ '_27FUO', '_1PPA6' ],
    // Found in the "app" stylesheet. Adds a light gray color.
    [INACTIVE_LIST_ACTION_LINK]: [ '_3cbXv' ],
    // Found by searching for the "notification" result color (applied when using the "Can't listen now" button eg).
    [SOLUTION_TOKEN_SEPARATOR]: [ '_2QmYK', '_20psa', '_3wqVs', '_2n6ud' ],
    // Found in the "app" stylesheet. Adds the page background color.
    [PAGINATION_WRAPPER]: [ '_1Nb-2', 'FohH5' ],
    [PAGE_SIZE_LINK]: [ '_27FUO', '_1PPA6' ],
    [PAGE_SIZE_SELECT_WRAPPER]: [ '_27FUO', '_1PPA6' ],
    [PAGE_SIZE_SELECT]: [ '_27FUO', '_1PPA6' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [TITLE]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    [TITLE_TEXT]: {
      flex: 1,
      marginRight: '1rem',
      '@media (max-width: 699px)': {
        marginBottom: '0.5rem',
      },
    },
    [TITLE_HINT]: {
      marginLeft: '0.5rem',
      verticalAlign: 'middle',
    },
    [TITLE_LINK_WRAPPER]: {
      '@media (any-pointer: coarse)': {
        lineHeight: '2em',
      },
      '@media (max-width: 699px)': {
        marginBottom: '0.5em',
      },
    },
    [FLAG_FILTER_OPTION]: {
      display: 'flex',
      margin: '10px 0',
    },
    [FLAG_FILTER_CHECKBOX]: {
      marginRight: '0.5rem',
      ':disabled': {
        cursor: 'not-allowed',
      },
    },
    [FLAG_FILTER_MATCH_COUNT]: {
      fontSize: '0.8em',
      marginLeft: '0.5rem',
    },
    [LIST_ACTION_LINK_WRAPPER]: {
      display: 'flex',
      gap: '0.5rem',
      justifyContent: 'space-between',
      marginLeft: '1rem',
      userSelect: 'none',
    },
    [LIST_ACTION_LINK]: {
      cursor: 'pointer',
      height: '2.25rem',
      left: 0,
      position: 'relative',
      top: 0,
      transform: 'none',
      width: '2.25rem',
      zIndex: '0',
    },
    [ACTIVE_LIST_ACTION_LINK]: {
      borderColor: 'currentColor',
    },
    [INACTIVE_LIST_ACTION_LINK]: {
      color: 'rgb(var(--color-hare))',
    },
    [DISABLED_LIST_ACTION_LINK]: {
      cursor: 'not-allowed',
    },
    [EMPTY_LIST]: {
      fontStyle: 'italic',
      margin: '1em 0 0',
    },
    [SOLUTION]: {
      padding: '0.5em 0.5em 0.35em',
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
    [PAGINATION_WRAPPER]: {
      bottom: '0',
      padding: '0.1em 0 0 !important',
      position: 'sticky',
    },
  }),
};
