import { h } from 'preact';
import { useKey, useKeyPress } from 'preact-use';
import { StyleSheet } from 'aphrodite';
import { isNumber, noop } from 'lodash';
import Paginator from 'paginator';
import { BASE, useStyles, useThrottledCallback } from './base';

const WRAPPER = 'wrapper';
const ITEM = 'item';
const BUTTON = 'button';
const INDEX_BUTTON = 'index_button';

const CLASS_NAMES = {
  [BASE]: {
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

const Pagination =
  ({
     activePage = 1,
     totalItemCount = 0,
     itemCountPerPage = 20,
     displayedPageCount = 5,
     onChange = noop,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS);

    const paginator = new Paginator(itemCountPerPage, displayedPageCount);
    const paginationData = paginator.build(totalItemCount, activePage);

    const [ isControlPressed ] = useKeyPress('Control');

    const onPrevious = useThrottledCallback((data, goToFirst, callback) => {
      if (data.has_previous_page) {
        if (goToFirst) {
          callback(1);
        } else {
          callback(data.previous_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onChange ]);

    const onNext = useThrottledCallback((data, goToLast, callback) => {
      if (data.has_next_page) {
        if (goToLast) {
          callback(data.total_pages);
        } else {
          callback(data.next_page);
        }
      }
    }, 50, [ paginationData, isControlPressed, onChange ]);

    useKey('ArrowLeft', onPrevious, {}, [ onPrevious ]);
    useKey('ArrowRight', onNext, {}, [ onNext ]);

    if (totalItemCount <= itemCountPerPage) {
      return null;
    }

    const renderButton = ({ key, label, disabled, onClick }) => {
      let buttonClassNames = getElementClassNames(BUTTON);

      if (isNumber(label)) {
        buttonClassNames += ` ${getElementClassNames(INDEX_BUTTON)}`;
      }

      return (
        <div key={key} className={getElementClassNames(ITEM)}>
          <button className={buttonClassNames} disabled={disabled} onClick={onClick}>
            {label}
          </button>
        </div>
      );
    };

    const pageButtons = [
      renderButton({
        key: 'first',
        label: '«',
        disabled: !paginationData.has_previous_page,
        onClick: () => onChange(1),
      }),
      renderButton({
        key: 'previous',
        label: '⟨',
        disabled: !paginationData.has_previous_page,
        onClick: () => onChange(paginationData.previous_page),
      }),
    ];

    for (let page = paginationData.first_page; page <= paginationData.last_page; page++) {
      pageButtons.push(
        renderButton({
          key: `page-${page}`,
          label: page,
          disabled: paginationData.current_page === page,
          onClick: () => onChange(page),
        }),
      );
    }

    pageButtons.push(
      renderButton({
        key: 'next',
        label: '⟩',
        disabled: !paginationData.has_next_page,
        onClick: () => onChange(paginationData.next_page),
      }),

      renderButton({
        key: 'last',
        label: '»',
        disabled: paginationData.current_page === paginationData.total_pages,
        onClick: () => onChange(paginationData.total_pages),
      }),
    );

    return (
      <div className={getElementClassNames(WRAPPER)}>
        {pageButtons}
      </div>
    );
  };

export default Pagination;
