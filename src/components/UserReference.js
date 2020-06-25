import { h, Fragment } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet } from 'aphrodite';
import moize from 'moize';
import { BASE, CONTEXT_CHALLENGE, CONTEXT_FORUM, useStyles } from './base';
import { discardEvent, noop } from '../functions';

const FORUM_FOLLOW_BUTTON_SELECTOR = '._13Bfz button';
const FORUM_NEW_POST_BUTTONS_SELECTOR = '._1KvMS textarea + div button';

/**
 * @function
 * @returns {object|null} When in the context of a forum discussion, the inline styles applied to the new post buttons.
 */
const getForumNewPostButtonsInlineStyles = moize(
  () => {
    const postButtons = Array.from(document.querySelectorAll(FORUM_NEW_POST_BUTTONS_SELECTOR));

    return (2 !== postButtons.length)
      ? null
      : {
        [COMMIT_BUTTON]: String(postButtons[0].getAttribute('style') || ''),
        [ROLLBACK_BUTTON]: String(postButtons[1].getAttribute('style') || ''),
      };
  }
);

/**
 * @function
 * @returns {string|null} When in the context of a forum discussion, the inline styles applied to the follow button.
 */
const getForumFollowButtonInlineStyles = moize(
  () => {
    const followButton = document.querySelector(FORUM_FOLLOW_BUTTON_SELECTOR);
    return String(followButton && followButton.getAttribute('style') || '');
  }
);

const UserReference =
  ({
     context = CONTEXT_CHALLENGE,
     reference = '',
     onChange = noop,
     isEditable = true,
   }) => {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ editedReference, setEditedReference ] = useState(reference);
    const editInput = useRef(null);

    const valueKeys = [
      VALUE,
      isEditable && EDITABLE_VALUE,
      ('' === reference) && EMPTY_VALUE,
    ].filter(Boolean);

    const getElementClassNames = useStyles(CLASS_NAMES, STYLE_SHEETS, [ context ]);

    let buttonInlineStyles = {};
    let additionalButtonClass = null;

    if (CONTEXT_FORUM === context) {
      buttonInlineStyles = getForumNewPostButtonsInlineStyles();

      if (null === buttonInlineStyles) {
        const inlineStyles = getForumFollowButtonInlineStyles();

        buttonInlineStyles = {
          [COMMIT_BUTTON]: inlineStyles,
          [ROLLBACK_BUTTON]: inlineStyles,
        };

        additionalButtonClass = FALLBACK_BUTTON;
      }
    }

    const commitEdit = useCallback(event => {
      discardEvent(event);
      const newReference = editedReference.trim();

      if (
        ('' !== newReference)
        && (newReference !== reference)
        && (editedReference !== reference)
      ) {
        onChange(editedReference);
      } else {
        setEditedReference(reference)
      }

      setIsEditing(false);
    }, [ reference, onChange, setIsEditing, editedReference ]);

    const rollbackEdit = useCallback(event => {
      discardEvent(event);
      setIsEditing(false);
      setEditedReference(reference);
    }, [ reference, setIsEditing, setEditedReference ]);

    const onEditKeyDown = useCallback(event => {
      if ('Enter' === event.key) {
        commitEdit(event);
      } else if ('Escape' === event.key) {
        rollbackEdit(event);
      }
    }, [ commitEdit, rollbackEdit ]);

    const onEditKeyUp = useCallback(event => {
      discardEvent(event);
      setEditedReference(event.target.value);
    }, [ setEditedReference ]);

    // Focuses the input when we just have switched to edit mode.
    useEffect(() => {
      if (editInput.current) {
        setTimeout(() => {
          if (document.activeElement !== editInput.current.focused) {
            const length = editInput.current.value.length;
            editInput.current.focus();
            editInput.current.setSelectionRange(length + 1, length + 1);
          }
        });
      }
    }, [ isEditing, editInput ]);

    const [ Wrapper, Title, Value, EditWrapper ] = (CONTEXT_CHALLENGE === context)
      ? [ 'div', 'h3', 'p', 'p' ]
      : [ 'h2', 'span', 'span', Fragment ];

    return (
      <IntlProvider scope="user_reference">
        <Wrapper className={getElementClassNames(WRAPPER)}>
          <Title className={getElementClassNames(TITLE)}>
            <Text id="your_reference">Your reference:</Text>
          </Title>
          {!isEditing
            ? ( // Not editing.
              <Value onClick={() => isEditable && setIsEditing(true)}
                     className={getElementClassNames(valueKeys)}>
                {('' !== reference) ? reference : <Text id="none">None yet</Text>}
              </Value>
            ) : ( // Editing.
              <EditWrapper>
                <textarea ref={editInput}
                          dir="auto"
                          onKeyDown={onEditKeyDown}
                          onKeyUp={onEditKeyUp}
                          className={getElementClassNames(EDIT_FIELD)}>
                  {editedReference}
                </textarea>
                <button onClick={commitEdit}
                        style={buttonInlineStyles[COMMIT_BUTTON] || ''}
                        className={getElementClassNames([ BUTTON, COMMIT_BUTTON, additionalButtonClass ])}>
                  <Text id="update">Update</Text>
                </button>
                <span className={getElementClassNames(BUTTON_SPACER)}>
                  <button onClick={rollbackEdit}
                          style={buttonInlineStyles[ROLLBACK_BUTTON] || ''}
                          className={getElementClassNames([ BUTTON, ROLLBACK_BUTTON, additionalButtonClass ])}>
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
const FALLBACK_BUTTON = 'fallback_button';
const BUTTON_SPACER = 'button_spacer';

const CLASS_NAMES = {
  [CONTEXT_CHALLENGE]: {
    [EDIT_FIELD]: [
      '_2mhBk',
      '_1JtWw',
      '_1tY-d',
      '_66Mfn',
      '_2NQKM',
    ],
    [BUTTON]: [
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
    [COMMIT_BUTTON]: [ '_2rA41' ],
  },
  [CONTEXT_FORUM]: {
    [WRAPPER]: [ '_2qRu2' ],
    [TITLE]: [ '_1gXMJ' ],
    [EDIT_FIELD]: [ '_1Ch3x', '_2yvtl', 'gFN2J' ],
    [BUTTON]: [ '_2NzLI', 'QHkFc' ],
    [COMMIT_BUTTON]: [ '_1qPrY', '_2pnz9' ],
    [ROLLBACK_BUTTON]: [ '_3kaGF', '_1O1Bz' ],
    [FALLBACK_BUTTON]: [ '_1O1Bz' ],
    [BUTTON_SPACER]: [ '_3cCqs' ],
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
    [COMMIT_BUTTON]: {
      ':after': {
        borderColor: 'currentColor',
      },
    },
    [BUTTON_SPACER]: {
      marginLeft: '10px',
    },
  }),
};
