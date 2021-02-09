/**
 * The code of the extension.
 *
 * @type {string}
 */
export const EXTENSION_CODE = 'duolingo-solution-viewer';

/**
 * A prefix based on the extension code.
 *
 * @type {string}
 */
export const EXTENSION_PREFIX = '_duo-sv_';

/**
 * The fallback locale in case the UI locale can not be determined.
 *
 * @type {string}
 */
export const DEFAULT_LOCALE = 'en';

/**
 * The internal types identifying translation challenges.
 *
 * @type {string[]}
 */
export const UI_TRANSLATION_CHALLENGE_TYPES = [
  'name',
  'translate',
  'completeReverseTranslation',
];

/**
 * The internal types identifying listening challenges.
 *
 * @type {string[]}
 */
export const UI_LISTENING_CHALLENGE_TYPES = [
  'listen',
  'listenTap',
];

/**
 * The internal types identifying naming challenges.
 *
 * @type {string[]}
 */
export const UI_NAMING_CHALLENGE_TYPES = [
  'name',
];

/**
 * The internal types identifying challenges providing word banks.
 *
 * @type {string[]}
 */
export const UI_WORD_BANK_CHALLENGE_TYPES = [
  'listenTap',
];

/**
 * The type of challenges that require the user to translate a sentence.
 *
 * @type {number}
 */
export const CHALLENGE_TYPE_TRANSLATION = 0b001;

/**
 * The type of challenges that require the user to name a picture.
 *
 * @type {number}
 */
export const CHALLENGE_TYPE_NAMING = 0b011;

/**
 * The type of challenges that require the user to recognize a spoken sentence.
 *
 * @type {number}
 */
export const CHALLENGE_TYPE_LISTENING = 0b100;

/**
 * A unique constant for when a result is unknown.
 *
 * @type {string}
 */
export const RESULT_NONE = 'none';

/**
 * A unique constant for the type of correct challenge results.
 *
 * @type {string}
 */
export const RESULT_CORRECT = 'correct';

/**
 * A unique constant for the type of incorrect challenge results.
 *
 * @type {string}
 */
export const RESULT_INCORRECT = 'incorrect';

/**
 * The result of failed background actions.
 *
 * @type {string}
 */
export const ACTION_RESULT_FAILURE = 'failure';

/**
 * The result of successful background actions.
 *
 * @type {string}
 */
export const ACTION_RESULT_SUCCESS = 'success';

/**
 * The type of the messages wrapping a request for a background action.
 *
 * @type {string}
 */
export const MESSAGE_TYPE_ACTION_REQUEST = `${EXTENSION_PREFIX}-action_request_`;

/**
 * The type of the messages wrapping the result of a background action.
 *
 * @type {string}
 */
export const MESSAGE_TYPE_ACTION_RESULT = `${EXTENSION_PREFIX}-action_result_`;

/**
 * The type of the background action usable to fetch the current translation challenge from a running practice session.
 *
 * @type {string}
 */
export const ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE = 'get_current_translation_challenge';

/**
 * The type of the background action usable to fetch the current listening challenge from a running practice session.
 *
 * @type {string}
 */
export const ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE = 'get_current_listening_challenge';

/**
 * The type of the background action usable to update the user answer / reference associated to a given challenge from
 * a running practice session.
 *
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE = 'update_current_challenge_user_reference';

/**
 * The type of the background action usable to fetch the challenge discussed by a forum comment.
 *
 * @type {string}
 */
export const ACTION_TYPE_GET_COMMENT_CHALLENGE = 'get_comment_challenge';

/**
 * The type of the background action usable to update the user answer / reference associated to the challenge
 * corresponding to a given forum comment.
 *
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE = 'update_comment_challenge_user_reference';

/**
 * The types of the available background actions.
 *
 * @type {string[]}
 */
export const ACTION_TYPES = [
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE,
];

/**
 * The type of the messages wrapping an event notification from the UI scripts.
 *
 * @type {string}
 */
export const MESSAGE_TYPE_UI_EVENT_NOTIFICATION = `${EXTENSION_PREFIX}-ui_event_notification_`

/**
 * The type of the event occurring when a new practice session has been loaded.
 *
 * @type {string}
 */
export const EVENT_TYPE_SESSION_LOADED = 'session_loaded';

/**
 * The type of the event occurring when a forum discussion has been loaded.
 *
 * @type {string}
 */
export const EVENT_TYPE_DISCUSSION_LOADED = 'discussion_loaded';

/**
 * The type of the event occurring when a sound is played.
 *
 * @type {string}
 */
export const EVENT_TYPE_SOUND_PLAYED = 'sound_played';

/**
 * The types of the different events that can occur on the UI and are meaningful to the extension.
 *
 * @type {string[]}
 */
export const EVENT_TYPES = [
  EVENT_TYPE_SESSION_LOADED,
  EVENT_TYPE_DISCUSSION_LOADED,
  EVENT_TYPE_SOUND_PLAYED,
];

/**
 * An empty placeholder for a challenge.
 *
 * @type {import('./background.js').Challenge}
 */
export const EMPTY_CHALLENGE = {
  statement: '',
  solutions: [],
  fromLanguage: '',
  toLanguage: '',
  discussionId: '',
};

/**
 * A word match result indicating that a word is not present anywhere in another.
 *
 * @type {number}
 */
export const WORD_MATCH_NONE = 0b0000;

/**
 * A word match result indicating that a word is present somewhere in another.
 *
 * @type {number}
 */
export const WORD_MATCH_ANYWHERE = 0b0001;

/**
 * A word match result indicating that a word is present at the start of another.
 *
 * @type {number}
 */
export const WORD_MATCH_START = 0b0011;

/**
 * A word match result indicating that a word is present at the end of another.
 *
 * @type {number}
 */
export const WORD_MATCH_END = 0b0101;

/**
 * A word match result indicating that a word is equal to another.
 *
 * @type {number}
 */
export const WORD_MATCH_EXACT = 0b1111;

/**
 * The URL of the image CDN as was last seen, usable as a fallback.
 *
 * @type {string}
 */
export const IMAGE_CDN_DEFAULT_BASE_URL = 'https://d35aaqx5ub95lt.cloudfront.net/';
