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
export const TRANSLATION_CHALLENGE_TYPES = [
  'name',
  'translate',
  'completeReverseTranslation',
];

/**
 * The internal types identifying listening challenges.
 *
 * @type {string[]}
 */
export const LISTENING_CHALLENGE_TYPES = [
  'listen',
  'listenTap',
];

/**
 * The internal types identifying naming challenges.
 *
 * @type {string[]}
 */
export const NAMING_CHALLENGE_TYPES = [
  'name',
];

/**
 * The internal types identifying challenges providing word banks.
 *
 * @type {string[]}
 */
export const WORD_BANK_CHALLENGE_TYPES = [
  'listenTap',
];

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
 * The colors of the original theme (as were last seen) for the different result types.
 *
 * @type {object.<string, string>}
 */
export const DEFAULT_RESULT_COLORS = {
  [RESULT_CORRECT]: '#58a700',
  [RESULT_INCORRECT]: '#ea2b2b',
};

/**
 * The URL of the image CDN (as was last seen), usable as a fallback.
 *
 * @type {string}
 */
export const IMAGE_CDN_DEFAULT_BASE_URL = 'https://d35aaqx5ub95lt.cloudfront.net/';

/**
 * A CSS selector for menu icons.
 *
 * @type {string}
 */
export const MENU_ICON_SELECTOR = 'img._1TuHK';

/**
 * The class names used by the original sentence icon element.
 * It can currently be found by searching for "type-sentence.svg" in the "session" stylesheet.
 *
 * @type {string[]}
 */
export const SENTENCE_ICON_CLASS_NAMES = [ '_2seqj' ];

/**
 * The name of the meta tag in which to store the URL of the solution icon.
 *
 * @type {string}
 */
export const SOLUTION_ICON_URL_META_NAME = `${EXTENSION_PREFIX}-solution-icon-url`;

/**
 * The path of the close icon on the image CDN.
 *
 * @type {string}
 */
export const CLOSE_ICON_CDN_PATH = 'images/x.svg';

/**
 * A RegExp for the URL that is used by Duolingo to start a new practice session.
 *
 * @type {RegExp}
 */
export const NEW_SESSION_URL_REGEXP = /\/[\d]{4}-[\d]{2}-[\d]{2}\/sessions/g;

/**
 * A RegExp for the URLs of forum comments.
 *
 * @type {RegExp}
 */
export const FORUM_COMMENT_URL_REGEXP = /forum\.duolingo\.com\/comment\/([\d]+)/;

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
 * The type of the background action usable to match the solutions of a challenge with a user answer.
 * 
 * @type {string}
 */
export const ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER = 'match_challenge_with_user_answer';

/**
 * The type of the background action usable to fetch the challenge discussed by a forum comment.
 *
 * @type {string}
 */
export const ACTION_TYPE_GET_COMMENT_CHALLENGE = 'get_comment_challenge';

/**
 * The type of the background action usable to update the challenges addressed by some forum discussions.
 *
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES = 'update_discussion_challenges';

/**
 * The type of the background action usable to update the user answer/reference associated to a forum comment.
 *
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE = 'update_comment_user_reference';

/**
 * The types of the available background actions.
 *
 * @type {string[]}
 */
export const ACTION_TYPES = [
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER,
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES,
  ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE,
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
 * The type of the event occurring when a sound is played.
 *
 * @type {string}
 */
export const EVENT_TYPE_SOUND_PLAYED = 'sound_played';

/**
 * The types of the different events that can occur on the page and are meaningful to the extension.
 *
 * @type {string[]}
 */
export const EVENT_TYPES = [
  EVENT_TYPE_SESSION_LOADED,
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
