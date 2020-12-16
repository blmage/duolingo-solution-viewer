import { h } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useClickAway, useKey } from 'preact-use';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ReactTags from 'react-tag-autocomplete';
import { it } from 'param.macro';
import { matchSorter } from 'match-sorter';

import {
  EXTENSION_CODE,
  WORD_MATCH_ANYWHERE,
  WORD_MATCH_END,
  WORD_MATCH_EXACT,
  WORD_MATCH_START
} from '../constants';

import { discardEvent, identity, noop, normalizeString } from '../functions';
import { getStringMatchableWords } from '../solutions';
import { addContext, BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, usePortalContainer, useStyles } from './index';
import Dropdown from './Dropdown';

/**
 * @typedef {object} WordFilter
 * @property {string} word The word to filter.
 * @property {string} matchMode How to search for the word in solution tokens.
 * @property {boolean} isExcluded Whether the word should be absent from the solutions.
 */

/**
 * A convenience map from the first and last characters of a query to the corresponding match mode.
 *
 * @type {object}
 */
const MATCH_MODE_MAP = {
  '': {
    '': WORD_MATCH_EXACT,
    '*': WORD_MATCH_START,
  },
  '*': {
    '': WORD_MATCH_END,
    '*': WORD_MATCH_ANYWHERE,
  }
};

/**
 * @type {Array}
 */
const FILTER_SETTINGS = [
  {
    key: 'isExcluded',
    values: [
      {
        value: false,
        icon: 'check',
        labelId: 'present',
        defaultLabel: 'Present',
      },
      {
        value: true,
        icon: 'times',
        labelId: 'absent',
        defaultLabel: 'Absent',
      },
    ],
  },
  {
    key: 'matchMode',
    values: [
      {
        value: WORD_MATCH_EXACT,
        icon: 'equals',
        labelId: 'exact_word',
        defaultLabel: 'Exact word',
      },
      {
        value: WORD_MATCH_START,
        icon: 'arrow-from-left',
        labelId: 'at_word_start',
        defaultLabel: 'At the start of a word',
      },
      {
        value: WORD_MATCH_END,
        icon: 'arrow-to-right',
        labelId: 'at_word_end',
        defaultLabel: 'At the end of a word',
      },
      {
        value: WORD_MATCH_ANYWHERE,
        icon: 'question',
        labelId: 'anywhere_in_word',
        defaultLabel: 'Anywhere in a word',
      },
    ],
  },
];

const FilterSetting = ({ context, setting: { key, values }, currentFilter, onUpdate }) => {
  const menu = useRef();
  const wrapper = useRef();
  const [ isMenuDisplayed, setIsMenuDisplayed ] = useState(false);

  const currentValue = values.find(it.value === currentFilter[key]);

  const onCloseMenu = () => setIsMenuDisplayed(false);

  const onSelect = value => {
    onCloseMenu();
    onUpdate({ ...currentFilter, [key]: value });
  };

  const onToggleMenu = event => {
    discardEvent(event);
    setIsMenuDisplayed(!isMenuDisplayed);
  };

  useClickAway([ wrapper, menu ], onCloseMenu);

  const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

  return (
    <Localizer>
      <div
        ref={wrapper}
        onClick={onToggleMenu}
        title={<Text id={currentValue.labelId}>{currentValue.defaultLabel}</Text>}
        className={getElementClassNames(FILTER_SETTING)}
      >
        <FontAwesomeIcon
          icon={currentValue.icon}
          size="xs"
          fixedWidth
          className={getElementClassNames(FILTER_SETTING_ICON)}
        />
        {isMenuDisplayed && (
          <div>
            <Dropdown
              ref={menu}
              context={context}
              options={values}
              getOptionKey={({ value }) => value}
              onSelect={onSelect}
              onClose={onCloseMenu}
            />
          </div>
        )}
      </div>
    </Localizer>
  );
};

const Filter = ({ context, tag, onUpdate, onDelete, removeButtonText, classNames }) => (
  <div onClick={onDelete} title={removeButtonText} className={classNames.selectedTag}>
    {FILTER_SETTINGS.map(setting => (
      <FilterSetting
        context={context}
        setting={setting}
        currentFilter={tag}
        onUpdate={onUpdate}
      />
    ))}
    <span className={classNames.selectedTagName}>{tag.word}</span>
  </div>
);

const SuggestionsDropdown = ({ context, classNames, children }) => {
  const [ isClosed, setIsClosed ] = useState(false);

  // Reopens the dropdown after a scroll / resize event when the suggestions have changed.
  useEffect(() => setIsClosed(false), [ children, setIsClosed ]);

  if (isClosed) {
    return null;
  }

  return (
    <div className={classNames.suggestions}>
      <Dropdown
        context={context}
        options={children}
        renderOption={identity}
        onClose={() => setIsClosed(true)}
      />
    </div>
  );
};

const WordFilterInput =
  ({
     context = CONTEXT_CHALLENGE,
     filters = [],
     matchingData = {},
     onChange = noop,
   }) => {
    const {
      words: suggestableWords = [],
      locale = '',
      matchingOptions = {},
    } = matchingData;

    const suggestions = useMemo(() => (
      suggestableWords.map((name, id) => ({
        id,
        name,
        searchable: normalizeString(name, false, true),
      }))
    ), [ suggestableWords ]);

    // Extracts a word filter from a user query.
    const parseWordFilter = useCallback(query => {
      const [ , sign = '', start = '', base = '', end = '' ] = /^([-+]?)(\*?)(.+?)(\*?)$/ug.exec(query) || [];

      const word = getStringMatchableWords(base, locale, matchingOptions)[0] || '';
      const matchMode = MATCH_MODE_MAP[start][end];
      const isExcluded = sign === '-';

      return { word, matchMode, isExcluded };
    }, [ locale, matchingOptions ]);

    // Filters the words that should be proposed to the user based on the current query.
    const filterSuggestions = useCallback((query, suggestions) => {
      const { word } = parseWordFilter(query);

      if (word.length < 2) {
        return [];
      }

      // The underlying library used to remove diacritics is based on a fixed list of characters,
      // which lacks some cases such as "ạ" or "ả".
      return {
        options: matchSorter(
          suggestions,
          normalizeString(word, false, true),
          {
            keepDiacritics: true,
            keys: [ 'searchable' ],
          }
        ),
        highlightedQuery: word,
      };
    }, [ parseWordFilter ]);

    const onAddFilter = useCallback(({ id = null, name }, query) => {
      let filter;

      if (id) {
        const { matchMode, isExcluded } = parseWordFilter(query);
        filter = { word: name, matchMode, isExcluded };
      } else {
        filter = parseWordFilter(name);
      }

      onChange([ ...filters.filter(it.word !== filter.word), filter ]);
    }, [ filters, onChange, parseWordFilter ]);

    const onUpdateFilter = useCallback((index, filter) => {
      if (filters[index]) {
        const updated = filters.slice();
        updated.splice(index, 1, filter);
        onChange(updated);
      }
    }, [ filters, onChange ]);

    const onDeleteFilter = useCallback(index => {
      if (filters[index]) {
        const updated = filters.slice();
        updated.splice(index, 1);
        onChange(updated);
      }
    }, [ filters, onChange ]);

    // Use a portal for the sizer, in case the input is rendered inside a hidden container.
    const sizerContainer = usePortalContainer();

    const tagsInput = useRef();

    const onKeyDown = event => {
      // Stop propagation of "keydown" events for the search input,
      // to prevent Duolingo from handling them when the word bank is active (and calling preventDefault()).
      event.stopPropagation();

      if (('Escape' === event.key) && tagsInput.current) {
        tagsInput.current.blur();
      }
    }

    useKey('f', () => tagsInput.current && setTimeout(() => tagsInput.current.focus()));

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    return (
      <IntlProvider scope="word_filter">
        <Localizer>
          <ReactTags
            ref={tagsInput}
            id={`${EXTENSION_CODE}-word-filter-tag`}
            tags={filters}
            suggestions={suggestions}
            suggestionsTransform={filterSuggestions}
            allowNew={true}
            delimiters={[ 'Enter', ' ', ',', ';' ]}
            onAddition={onAddFilter}
            onUpdate={onUpdateFilter}
            onDelete={onDeleteFilter}
            onKeyDown={onKeyDown}
            placeholderText={<Text id="add_word_to_filter">Add a word to filter</Text>}
            removeButtonText={<Text id="click_to_remove_filter">Click to remove filter</Text>}
            tagComponent={addContext(Filter, context)}
            suggestionsComponent={addContext(SuggestionsDropdown, context)}
            autoresizePortal={sizerContainer}
            classNames={{
              root: getElementClassNames(WRAPPER),
              rootFocused: getElementClassNames(WRAPPER__ACTIVE),
              selected: getElementClassNames(FILTER_WRAPPER),
              selectedTag: getElementClassNames(FILTER),
              selectedTagName: getElementClassNames(FILTER_WORD),
              search: getElementClassNames(SEARCH_WRAPPER),
              searchInput: getElementClassNames(SEARCH_INPUT),
              suggestions: getElementClassNames(SUGGESTIONS),
              suggestion: getElementClassNames(SUGGESTION),
              suggestionActive: getElementClassNames(SUGGESTION__ACTIVE),
            }}
          />
        </Localizer>
      </IntlProvider>
    );
  };

const WRAPPER = 'wrapper';
const WRAPPER__ACTIVE = 'wrapper__active';
const FILTER_WRAPPER = 'filter_wrapper';
const FILTER = 'filter';
const FILTER_SETTING = 'filter_setting';
const FILTER_SETTING_ICON = 'filter_setting_icon';
const FILTER_SETTING_ACTION = 'filter_setting_action';
const FILTER_SETTING_ACTION_ICON = 'filter_setting_action_icon';
const FILTER_WORD = 'filter_word';
const SEARCH_WRAPPER = 'search_wrapper';
const SEARCH_INPUT = 'search_input';
const SUGGESTIONS = 'suggestions';
const SUGGESTION = 'suggestion';
const SUGGESTION__ACTIVE = 'suggestion__active';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [WRAPPER]: [
      // Copied from the answer text field. The class responsible for the height is ignored here.
      '_2EMUT',
      '_1QDX9',
      'st_Fn',
      '_2ti2i',
      'sXpqy',
      // Copied by searching for the same font size as the rest of the modal, with a gray color.
      // Found in the "sessions" stylesheet.
      '_3blqO',
    ],
    // Copied by searching for the main (link) color without side-effects.
    [SUGGESTION__ACTIVE]: [ '_2__FI' ],
  },
  [CONTEXT_FORUM]: {
    [WRAPPER]: [
      // Copied from the post text field. The class responsible for the height is ignored here.
      '_2yvtl',
      'gFN2J',
      // Copied by searching for a gray color to get the same result as on the challenge pages.
      'uFNEM',
    ],
    // Copied from the breadcrumbs items.
    [FILTER]: [ '_2dkQa' ],
    // Copied by searching for the main (link) color without side-effects.
    [SUGGESTION__ACTIVE]: [ '_1vrtM' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      display: 'flex',
      flexWrap: 'wrap',
      padding: '6px 7px 0',
      resize: 'none',
    },
    [WRAPPER__ACTIVE]: {
      borderColor: 'currentColor',
    },
    [FILTER_WRAPPER]: {
      display: 'flex',
      flexWrap: 'wrap',
    },
    [FILTER]: {
      alignItems: 'center',
      border: '2px solid currentColor',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 'bold',
      margin: '0 10px 6px 0',
      padding: '5px 10px 5px 6px',
      textTransform: 'lowercase',
    },
    [FILTER_SETTING]: {
      display: 'flex',
      padding: '4px',
      position: 'relative',
    },
    [FILTER_SETTING_ICON]: {
      width: '1em',
    },
    [FILTER_SETTING_ACTION]: {
      padding: '10px',
      width: '100%',
    },
    [FILTER_SETTING_ACTION_ICON]: {
      marginRight: '10px',
    },
    [FILTER_WORD]: {
      marginLeft: '4px',
    },
    [SEARCH_WRAPPER]: {
      alignItems: 'center',
      display: 'inline-flex',
      maxWidth: '100%',
      position: 'relative',
    },
    [SEARCH_INPUT]: {
      background: 'none',
      border: 0,
      color: 'inherit',
      maxWidth: '100%',
      margin: '1px 0 5px',
      padding: '10px 2px',
      '::placeholder': {
        color: 'inherit',
      },
    },
    [SUGGESTIONS]: {
      left: '50%',
      marginTop: '-15px',
      position: 'absolute',
      top: '100%',
    },
    [SUGGESTION]: {
      padding: '10px',
      width: '100%',
    },
  }),
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [WRAPPER]: {
      margin: '10px 0',
    },
  }),
};

export default WordFilterInput;
