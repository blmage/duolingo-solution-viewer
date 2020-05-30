import { h } from 'preact';
import { useCallback } from 'preact/hooks';
import { useKeyPress, useKeyPressEvent } from 'preact-use';
import { StyleSheet } from 'aphrodite';
import { noop } from 'lodash';
import Paginator from 'paginator';
import { BASE, useStyles } from './base';

const WRAPPER = 'wrapper';
const ITEM = 'item';
const BUTTON = 'button';

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
    }
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

    const onPrevious = useCallback(() => {
      if (paginationData.has_previous_page) {
        if (isControlPressed) {
          onChange(1);
        } else {
          onChange(paginationData.previous_page);
        }
      }
    }, [ paginationData, isControlPressed, onChange ]);

    const onNext = useCallback(() => {
      if (paginationData.has_next_page) {
        if (isControlPressed) {
          onChange(paginationData.total_pages);
        } else {
          onChange(paginationData.next_page);
        }
      }
    }, [ paginationData, isControlPressed, onChange ]);

    useKeyPressEvent('ArrowLeft', onPrevious);
    useKeyPressEvent('ArrowRight', onNext);

    if (totalItemCount <= itemCountPerPage) {
      return null;
    }

    const renderButton = ({ key, label, disabled, onClick }) => {
      return (
        <div key={key} className={getElementClassNames(ITEM)}>
          <button className={getElementClassNames(BUTTON)} disabled={disabled} onClick={onClick}>
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
