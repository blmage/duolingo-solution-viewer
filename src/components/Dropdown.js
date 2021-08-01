import { h } from 'preact';
import { createPortal, forwardRef } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { Localizer, Text } from 'preact-i18n';
import { useMergeRefs } from 'use-callback-ref';
import { StyleSheet } from 'aphrodite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { it } from 'one-liner.macro';
import { noop } from 'duo-toolbox/utils/functions';
import { discardEvent, getAncestorsWithScrollOverflow } from 'duo-toolbox/utils/ui';
import { BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, usePortalContainer, useStyles } from './index';

export const Item =
  ({
     context,
     icon = null,
     labelId,
     labelFields = {},
     defaultLabel,
   }) => {
    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    const label = <Text id={labelId} fields={labelFields}>{defaultLabel}</Text>;

    return (
      <Localizer>
        <div title={label} className={getElementClassNames(ITEM)}>
          {icon && (
            <FontAwesomeIcon
              icon={icon}
              fixedWidth
              className={getElementClassNames(ITEM_ICON)}
            />
          )}
          {label}
        </div>
      </Localizer>
    );
  };

const Dropdown = forwardRef(
  (
    {
      context = CONTEXT_CHALLENGE,
      getOptionKey = ((option, index) => index),
      renderOption = (option => <Item {...option} context={context} />),
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

        const scrollableAncestors = getAncestorsWithScrollOverflow(wrapper.current);

        window.addEventListener('resize', onClose);
        scrollableAncestors.forEach(it.addEventListener('scroll', onClose));

        return () => {
          window.removeEventListener('resize', onClose);
          scrollableAncestors.forEach(it.removeEventListener('scroll', onClose));
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
        <div key={key} onClick={onClick} className={getElementClassNames(ITEM_WRAPPER)}>
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
const ITEM_WRAPPER = 'item_wrapper';
const ITEM = 'item';
const ITEM_ICON = 'item_icon';

const CLASS_NAMES = {
  // Copied from the "More" / "..." menu in both cases.
  [CONTEXT_CHALLENGE]: {
    [WRAPPER]: [ '_2O14B', '_2XlFZ', '_1v2Gj' ],
    [ARROW]: [ 'ite_X' ],
    [ARROW_ICON]: [ '_3p5e9' ],
    [ITEMS]: [ '_1KUxv' ],
    [ITEM_WRAPPER]: [ '_3kz3Z', '_3jIW4' ],
  },
  [CONTEXT_FORUM]: {
    [WRAPPER]: [ '_32PCq', 'MAAV-', 'dkZje' ],
    [ARROW]: [ '_7UVIL' ],
    [ARROW_ICON]: [ 'QNCcj' ],
    [ITEMS]: [ '_1UtJe' ],
    // The class corresponding to the item text is also added here to get the correct color.
    [ITEM_WRAPPER]: [ '_3_pNV', 'H_C0j', '_2Iddf' ],
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
    [ITEM_WRAPPER]: {
      fontWeight: 'normal',
      padding: 0,
      textTransform: 'none',
    },
    [ITEM]: {
      padding: '10px',
      width: '100%',
    },
    [ITEM_ICON]: {
      marginRight: '10px',
    },
  }),
};

export default Dropdown;
