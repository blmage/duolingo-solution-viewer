import { h, Fragment } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import { noop } from 'duo-toolbox/utils/functions';
import { discardEvent } from 'duo-toolbox/utils/ui';
import { BASE, CONTEXT_CHALLENGE, useStyles } from './index';

const UserReference =
  ({
     context = CONTEXT_CHALLENGE,
     reference = '',
     isEditable = true,
     onUpdate = noop,
   }) => {
    const editInput = useRef();
    const [ isEditing, setIsEditing ] = useState(false);

    const commitEdit = useCallback(event => {
      discardEvent(event);

      if (editInput.current) {
        const newReference = String(editInput.current.value || '').trim();

        if (('' !== newReference) && (newReference !== reference)) {
          onUpdate(newReference);
        }
      }

      setIsEditing(false);
    }, [ reference, onUpdate, setIsEditing ]);

    const rollbackEdit = useCallback(event => {
      discardEvent(event);
      setIsEditing(false);
    }, [ setIsEditing ]);

    const onEditKeyDown = useCallback(event => {
      if ('Enter' === event.key) {
        commitEdit(event);
      } else if ('Escape' === event.key) {
        rollbackEdit(event);
      }
    }, [ commitEdit, rollbackEdit ]);

    // Focuses the input when we just have switched to edit mode.
    useEffect(() => {
      if (editInput.current) {
        setTimeout(() => {
          if (document.activeElement !== editInput.current.focused) {
            const length = editInput.current.value.length;
            editInput.current.focus();
            // Place the cursor at the end of the text.
            editInput.current.setSelectionRange(length + 1, length + 1);
          }
        });
      }
    }, [ isEditing, editInput ]);

    const [ Wrapper, Title, Value, EditWrapper ] = (CONTEXT_CHALLENGE === context)
      ? [ 'div', 'h3', 'p', 'p' ]
      : [ 'h2', 'span', 'span', Fragment ];

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    let buttonInlineStyles = {};
    let additionalButtonClass = null;

    const valueKeys = [
      VALUE,
      isEditable && EDITABLE_VALUE,
      ('' === reference) && EMPTY_VALUE,
    ].filter(Boolean);

    return (
      <IntlProvider scope="user_reference">
        <Wrapper className={getElementClassNames(WRAPPER)}>
          <Title className={getElementClassNames(TITLE)}>
            <Text id="your_reference">Your reference:</Text>
          </Title>
          {!isEditing
            ? ( // Not editing.
              <Value onClick={() => isEditable && setIsEditing(true)} className={getElementClassNames(valueKeys)}>
                {('' !== reference) ? reference : <Text id="none">None yet</Text>}
              </Value>
            ) : ( // Editing.
              <EditWrapper>
                <textarea
                  ref={editInput}
                  defaultValue={reference}
                  dir="auto"
                  onKeyDown={onEditKeyDown}
                  className={getElementClassNames(EDIT_FIELD)}
                />

                <button
                  onClick={commitEdit}
                  style={buttonInlineStyles[COMMIT_BUTTON] || ''}
                  className={getElementClassNames([ BUTTON, COMMIT_BUTTON, additionalButtonClass ])}
                >
                  <Text id="update">Update</Text>
                </button>

                <span className={getElementClassNames(BUTTON_SPACER)}>
                  <button
                    onClick={rollbackEdit}
                    style={buttonInlineStyles[ROLLBACK_BUTTON] || ''}
                    className={getElementClassNames([ BUTTON, ROLLBACK_BUTTON, additionalButtonClass ])}
                  >
                    <Text id="cancel">Cancel</Text>
                  </button>
                </span>
              </EditWrapper>
            )}
        </Wrapper>
      </IntlProvider>
    );
  };

export default UserReference;

const WRAPPER = 'wrapper';
const TITLE = 'title';
const VALUE = 'value';
const EMPTY_VALUE = 'empty_value';
const EDITABLE_VALUE = 'editable_value';
const EDIT_FIELD = 'edit_field';
const BUTTON = 'button';
const COMMIT_BUTTON = 'commit_button';
const ROLLBACK_BUTTON = 'rollback_button';
const BUTTON_SPACER = 'button_spacer';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [EDIT_FIELD]: [
      // Copied from the text answer field.
      '_2EMUT',
      '_1QDX9',
      'st_Fn',
      '_2ti2i',
      'sXpqy',
    ],
    [BUTTON]: [
      // Copied from the special letter buttons provided for some languages (such as French).
      // The class responsible for the small and square dimensions is ignored here.
      'WOZnx',
      '_275sd',
      '_1ZefG',
    ],
    // Found in the "app" stylesheet. Adds the main link color.
    // Use a class located after the one responsible for the color and background of the button.
    [COMMIT_BUTTON]: [ '_2__FI' ],
  },
};

const STYLE_SHEETS = {
  [BASE]: StyleSheet.create({
    [EMPTY_VALUE]: {
      fontStyle: 'italic',
    },
    [EDITABLE_VALUE]: {
      cursor: 'text',
    },
  }),
  [CONTEXT_CHALLENGE]: StyleSheet.create({
    [VALUE]: {
      fontWeight: 'normal',
      marginTop: '10px',
    },
    [EDIT_FIELD]: {
      marginBottom: '10px',
    },
    [BUTTON]: {
      ':before': {
        '--__internal__border-color': 'currentColor',
      },
    },
    [BUTTON_SPACER]: {
      marginLeft: '10px',
    },
  }),
};
