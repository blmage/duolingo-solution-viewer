import { h } from 'preact';
import { createPortal, forwardRef } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { useMergeRefs } from 'use-callback-ref';
import { StyleSheet } from 'aphrodite';
import { it } from 'param.macro';
import { discardEvent, getScrollableParents, noop } from '../functions';
import { BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, usePortalContainer, useStyles } from './index';

const Dropdown = forwardRef(
  (
    {
      context = CONTEXT_CHALLENGE,
      getOptionKey = ((option, index) => index),
      renderOption,
      options = [],
      onSelect = noop,
      onClose = noop,
    },
    ref
  ) => {
    const wrapper = useRef();
    const content = useRef();
    const portalContainer = usePortalContainer();

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    // Positions the content at the right spot, and closes the dropdown on any scroll or resize event.
    useEffect(() => {
      if (wrapper.current && content.current) {
        const { left: wrapperLeft, top: wrapperTop } = wrapper.current.getBoundingClientRect();

        const itemsWidth = content.current.clientWidth;
        const itemsBaseLeft = wrapperLeft - Math.ceil(itemsWidth / 2);
        const itemsMinLeft = 10;
        const itemsMaxLeft = document.body.clientWidth - itemsWidth - itemsMinLeft;
        const itemsLeft = Math.max(itemsMinLeft, Math.min(itemsBaseLeft, itemsMaxLeft));

        content.current.style.setProperty('top', `${wrapperTop}px`);
        content.current.style.setProperty('left', `${itemsLeft}px`);
        content.current.style.setProperty('visibility', 'visible', 'important');

        const parents = getScrollableParents(wrapper.current);

        window.addEventListener('resize', onClose);
        parents.forEach(it.addEventListener('scroll', onClose));

        return () => {
          window.removeEventListener('resize', onClose);
          parents.forEach(it.removeEventListener('scroll', onClose));
        }
      }
    }, [ onClose, wrapper, content ]);

    // Renders a single option.
    const renderOptionItem = (option, index) => {
      const key = getOptionKey(option, index);

      const onClick = event => {
        discardEvent(event);
        onSelect(key);
      };

      return (
        <div key={key} onClick={onClick} className={getElementClassNames(ITEM)}>
          {renderOption(option)}
        </div>
      );
    };

    return (
      <div ref={wrapper} className={getElementClassNames(WRAPPER)}>
        {createPortal(
          <div ref={useMergeRefs([ ref, content ])} className={getElementClassNames(CONTENT)}>
            <div className={getElementClassNames(ITEMS)}>
              {options.map(renderOptionItem)}
            </div>
          </div>,
          portalContainer
        )}
        {/* Keep the arrow within the DOM hierarchy so that it follows the content. */}
        <div className={getElementClassNames(ARROW)}>
          <div className={getElementClassNames(ARROW_ICON)} />
        </div>
      </div>
    );
  }
);

const WRAPPER = 'wrapper';
const CONTENT = 'content';
const ARROW = 'arrow';
const ARROW_ICON = 'arrow_icon';
const ITEMS = 'items';
const ITEM = 'item';

const CLASS_NAMES = {
  // Copied from the "More" / "..." menu in both cases.
  [CONTEXT_CHALLENGE]: {
    [WRAPPER]: [ '_13VDF', '_3-qu7', '_2WhLi' ],
    [ARROW]: [ '_3fuMA' ],
    [ARROW_ICON]: [ '_2nhmY' ],
    [ITEMS]: [ '_1Q4WV' ],
    [ITEM]: [ '_2FdDp', '_2wC9B' ],
  },
  [CONTEXT_FORUM]: {
    [WRAPPER]: [ '_1NClK', 'K_HbT', '_2QXjq' ],
    [ARROW]: [ '_3f_zH' ],
    [ARROW_ICON]: [ 'SaEU8' ],
    [ITEMS]: [ '_2iJ6U' ],
    // The class corresponding to the item text is added here to get the correct color.
    [ITEM]: [ '_21W8z', '_3QGyY', '_21hmH' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [WRAPPER]: {
      zIndex: 1,
    },
    [CONTENT]: {
      position: 'fixed',
      visibility: 'hidden',
      zIndex: '1000',
    },
    [ITEM]: {
      fontWeight: 'normal',
      padding: 0,
      textTransform: 'none',
    },
  }),
};

export default Dropdown;
