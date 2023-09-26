import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { useKey, useKeyPress } from 'preact-use';
import { IntlProvider, Localizer, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import Paginator from 'paginator';
import { isNumber, noop } from 'duo-toolbox/utils/functions';
import { isAnyInputFocused } from 'duo-toolbox/utils/ui';
import { BASE, CONTEXT_CHALLENGE, useStyles, useThrottledCallback } from './index';

const Pagination =
  ({
     context = CONTEXT_CHALLENGE,
     activePage = 1,
     totalItemCount = 0,
     itemCountPerPage = 20,
     displayedPageCount = 5,
     onPageChange = noop,
   }) => {
    const paginator = useMemo(() => (
      new Paginator(itemCountPerPage, displayedPageCount)
    ), [ itemCountPerPage, displayedPageCount ]);

    const paginationData = paginator.build(totalItemCount, activePage);

    const [ isControlPressed ] = useKeyPress('Control');

    const onPreviousKey = useThrottledCallback((data, goToFirst, callback) => {
      if (isAnyInputFocused()) {
        return;
      }

      if (data.has_previous_page) {
        if (goToFirst) {
          callback(1);
        } else {
          callback(data.previous_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onPageChange ]);

    const onNextKey = useThrottledCallback((data, goToLast, callback) => {
      if (isAnyInputFocused()) {
        return;
      }

      if (data.has_next_page) {
        if (goToLast) {
          callback(data.total_pages);
        } else {
          callback(data.next_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onPageChange ]);

    useKey('ArrowLeft', onPreviousKey, {}, [ onPreviousKey ]);
    useKey('ArrowRight', onNextKey, {}, [ onNextKey ]);

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    if (totalItemCount <= itemCountPerPage) {
      return null;
    }

    const renderButton = ({ key, disabled, label, title, titleKey, titleFields = {}, onClick }) => {
      let buttonClassNames = getElementClassNames(BUTTON);

      if (isNumber(label)) {
        buttonClassNames += ` ${getElementClassNames(INDEX_BUTTON)}`;
      }

      buttonClassNames += ` ${getElementClassNames(disabled ? DISABLED_BUTTON : ENABLED_BUTTON)}`;

      return (
        <div key={key} className={getElementClassNames(ITEM)}>
          <Localizer>
            <button
              title={<Text id={titleKey} fields={titleFields}>{title}</Text>}
              disabled={disabled}
              onClick={onClick}
              className={buttonClassNames}
            >
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
        onClick: () => onPageChange(1),
      }),
      renderButton({
        key: 'previous',
        label: '⟨',
        title: 'Go to previous page',
        titleKey: 'go_to_previous',
        disabled: !paginationData.has_previous_page,
        onClick: () => onPageChange(paginationData.previous_page),
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
          onClick: () => onPageChange(page),
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
        onClick: () => onPageChange(paginationData.next_page),
      }),

      renderButton({
        key: 'last',
        label: '»',
        title: 'Go to last page',
        titleKey: 'go_to_last',
        disabled: paginationData.current_page === paginationData.total_pages,
        onClick: () => onPageChange(paginationData.total_pages),
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
    // Copied from the global wrapper of the special letter buttons provided for some languages (such as French).
    // The class responsible for the null height is ignored here.
    [WRAPPER]: [ 'gcfYU' ],
    // Copied from the direct wrapper of each special letter button.
    [ITEM]: [ '_1OCDB' ],
    // Copied from the special letter buttons.
    [BUTTON]: [
      'WOZnx',
      '_275sd',
      '_1ZefG',
      '_3f9XI',
    ],
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
};
