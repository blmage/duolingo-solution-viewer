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
 * @type {symbol}
 */
export const RESULT_NONE = Symbol('none');

/**
 * A unique constant for the type of correct challenge results.
 *
 * @type {symbol}
 */
export const RESULT_CORRECT = Symbol('correct');

/**
 * A unique constant for the type of incorrect challenge results.
 *
 * @type {symbol}
 */
export const RESULT_INCORRECT = Symbol('incorrect');

/**
 * The colors of the original theme (as were last seen) for the different result types.
 *
 * @type {object.<symbol, string>}
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
export const MENU_ICON_SELECTOR = 'img.iZYCc';

/**
 * The class names used by the original sentence icon element.
 *
 * @type {string[]}
 */
export const SENTENCE_ICON_CLASS_NAMES = [ 'FtLT3' ];

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
 * The type of messages wrapping a request for a background action.
 *
 * @type {string}
 */
export const MESSAGE_TYPE_ACTION_REQUEST = `${EXTENSION_PREFIX}-action_request_`;

/**
 * The type of messages wrapping the result of a background action.
 *
 * @type {string}
 */
export const MESSAGE_TYPE_ACTION_RESULT = `${EXTENSION_PREFIX}-action_result_`;

/**
 * The type of the background action usable to fetch the challenge discussed by a forum comment.
 *
 * @type {string}
 */
export const ACTION_TYPE_GET_COMMENT_CHALLENGE = 'get_comment_challenge';

/**
 * The type of the background action usable to update the challenges discussed by some forum discussions.
 *
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES = 'update_discussion_challenges';

/**
 * The different types of available background actions.
 *
 * @type {string[]}
 */
export const ACTION_TYPES = [
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_UPDATE_DISCUSSION_CHALLENGES,
];
