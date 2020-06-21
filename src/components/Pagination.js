import { h } from 'preact';
import { useKey, useKeyPress } from 'preact-use';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { isNumber } from 'lodash';
import Paginator from 'paginator';
import { BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, useStyles, useThrottledCallback } from './base';
import { isInputFocused, noop } from '../functions';

const Pagination =
  ({
     context = CONTEXT_CHALLENGE,
     activePage = 1,
     totalItemCount = 0,
     itemCountPerPage = 20,
     displayedPageCount = 5,
     onChange = noop,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const paginator = new Paginator(itemCountPerPage, displayedPageCount);
    const paginationData = paginator.build(totalItemCount, activePage);

    const [ isControlPressed ] = useKeyPress('Control');

    const onPreviousKey = useThrottledCallback((data, goToFirst, callback) => {
      if (isInputFocused()) {
        return;
      }

      if (data.has_previous_page) {
        if (goToFirst) {
          callback(1);
        } else {
          callback(data.previous_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onChange ]);

    const onNextKey = useThrottledCallback((data, goToLast, callback) => {
      if (isInputFocused()) {
        return;
      }

      if (data.has_next_page) {
        if (goToLast) {
          callback(data.total_pages);
        } else {
          callback(data.next_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onChange ]);

    useKey('ArrowLeft', onPreviousKey, {}, [ onPreviousKey ]);
    useKey('ArrowRight', onNextKey, {}, [ onNextKey ]);

    if (totalItemCount <= itemCountPerPage) {
      return null;
    }

    const renderButton = ({ key, label, title, titleKey, titleFields = {}, disabled, onClick }) => {
      let buttonClassNames = getElementClassNames(BUTTON);

      if (isNumber(label)) {
        buttonClassNames += ` ${getElementClassNames(INDEX_BUTTON)}`;
      }

      if (!disabled) {
        buttonClassNames += ` ${getElementClassNames(ENABLED_BUTTON)}`;
      } else {
        buttonClassNames += ` ${getElementClassNames(DISABLED_BUTTON)}`;
      }

      return (
        <div key={key} className={getElementClassNames(ITEM)}>
          <Localizer>
            <button disabled={disabled}
                    onClick={onClick}
                    className={buttonClassNames}
                    title={
                      <Text id={titleKey} fields={titleFields}>{title}</Text>
                    }>
              <span className={getElementClassNames(BUTTON_LABEL)}>{label}</span>
            </button>
          </Localizer>
        </div>
      );
    };

    const pageButtons = [
      renderButton({
        key: 'first',
        label: '«',
        title: 'Go to first page',
        titleKey: 'go_to_first',
        disabled: !paginationData.has_previous_page,
        onClick: () => onChange(1),
      }),
      renderButton({
        key: 'previous',
        label: '⟨',
        title: 'Go to previous page',
        titleKey: 'go_to_previous',
        disabled: !paginationData.has_previous_page,
        onClick: () => onChange(paginationData.previous_page),
      }),
    ];

    for (let page = paginationData.first_page; page <= paginationData.last_page; page++) {
      pageButtons.push(
        renderButton({
          key: `page-${page}`,
          label: page,
          title: 'Go to page {{page}}',
          titleKey: 'go_to_page',
          titleFields: { page },
          disabled: paginationData.current_page === page,
          onClick: () => onChange(page),
        }),
      );
    }

    pageButtons.push(
      renderButton({
        key: 'next',
        label: '⟩',
        title: 'Go to next page',
        titleKey: 'go_to_next',
        disabled: !paginationData.has_next_page,
        onClick: () => onChange(paginationData.next_page),
      }),

      renderButton({
        key: 'last',
        label: '»',
        title: 'Go to last page',
        titleKey: 'go_to_last',
        disabled: paginationData.current_page === paginationData.total_pages,
        onClick: () => onChange(paginationData.total_pages),
      }),
    );

    return (
      <IntlProvider scope="pagination">
        <div className={getElementClassNames(WRAPPER)}>
          {pageButtons}
        </div>
      </IntlProvider>
    );
  };

export default Pagination;

const WRAPPER = 'wrapper';
const ITEM = 'item';
const BUTTON = 'button';
const DISABLED_BUTTON = 'disabled_button';
const ENABLED_BUTTON = 'enabled_button';
const INDEX_BUTTON = 'index_button';
const BUTTON_LABEL = 'button_label';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [WRAPPER]: [ '_2mM1T', '_1AQcy' ],
    [ITEM]: [ '_10S_q' ],
    [BUTTON]: [
      '_2dfXt',
      '_3ZQ9H',
      '_3lE5Q',
      '_18se6',
      'vy3TL',
      '_3iIWE',
      '_1Mkpg',
      '_1Dtxl',
      '_1sVAI',
      'sweRn',
      '_1BWZU',
      '_1LIf4',
      'QVrnU',
    ],
  },
  [CONTEXT_FORUM]: {
    [BUTTON]: [ 'QHkFc' ],
    [ENABLED_BUTTON]: [ '_1O1Bz', '_2NzLI' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      textAlign: 'center',
      '@media (max-width: 699px)': {
        display: 'block',
      },
    },
    [INDEX_BUTTON]: {
      '@media (max-width: 530px)': {
        display: 'none',
      },
    },
  }),
  [CONTEXT_FORUM]: StyleSheet.create({
    [WRAPPER]: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      marginTop: '1em',
    },
    [BUTTON]: {
      background: 'transparent',
      borderRadius: '12px',
      color: 'currentColor',
      height: '32px',
      lineHeight: '26px',
      margin: '0 2px',
      opacity: '0.5',
      overflow: 'hidden',
      position: 'relative',
      width: '32px',
    },
    [DISABLED_BUTTON]: {
      border: 0,
    },
    [ENABLED_BUTTON]: {
      ':hover': {
        ':before': {
          background: 'currentColor',
          bottom: 0,
          content: '""',
          display: 'block',
          // This seems to have almost the same effect as the original brightness filter, which does not work here.
          filter: 'invert(1)',
          left: 0,
          opacity: '0.3',
          position: 'absolute',
          right: 0,
          top: 0,
          zIndex: '-1',
        },
      },
    }
  }),
};
