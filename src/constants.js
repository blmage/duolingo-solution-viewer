import XRegExp from 'xregexp';

/**
 * The code of the extension.
 * @type {string}
 */
export const EXTENSION_CODE = 'duolingo-solution-viewer';

/**
 * A prefix based on the extension code.
 * @type {string}
 */
export const EXTENSION_PREFIX = '_duo-sv_';

/**
 * The fallback locale in case the UI locale can not be determined.
 * @type {string}
 */
export const DEFAULT_LOCALE = 'en';

/**
 * A regexp for capturing words in a sentence.
 * @constant {RegExp}
 */
export const SENTENCE_WORDS_REGEXP = new XRegExp('([\\pL\\pN]+)', 'g');

/**
 * A regexp for trimming non-word characters from a string.
 * @constant {RegExp}
 */
export const TRIMMED_WORDS_REGEXP = new XRegExp('([\\pL\\pN]+(.+[\\pL\\pN]+)*)', 'g');

/**
 * The internal types identifying translation challenges.
 * @type {string[]}
 */
export const TRANSLATION_CHALLENGE_TYPES = [
  'name',
  'translate',
  'completeReverseTranslation',
];

/**
 * The internal types identifying listening challenges.
 * @type {string[]}
 */
export const LISTENING_CHALLENGE_TYPES = [
  'listen',
  'listenTap',
];

/**
 * The internal types identifying naming challenges.
 * @type {string[]}
 */
export const NAMING_CHALLENGE_TYPES = [
  'name',
];

/**
 * The internal types identifying challenges providing word banks.
 * @type {string[]}
 */
export const WORD_BANK_CHALLENGE_TYPES = [
  'listenTap',
];

/**
 * A unique constant for the type of correct challenge results.
 * @type {symbol}
 */
export const RESULT_CORRECT = Symbol('correct');

/**
 * A unique constant for the type of incorrect challenge results.
 * @type {symbol}
 */
export const RESULT_INCORRECT = Symbol('incorrect');

/**
 * The colors of the original theme (as were last seen) for the different result types.
 * @type {Object.<Symbol, string>}
 */
export const DEFAULT_RESULT_COLORS = {
  [RESULT_CORRECT]: '#58a700',
  [RESULT_INCORRECT]: '#ea2b2b',
};

/**
 * The URL of the image CDN (as was last seen), usable as a fallback.
 * @type {string}
 */
export const IMAGE_CDN_DEFAULT_BASE_URL = 'https://d35aaqx5ub95lt.cloudfront.net/';

/**
 * A CSS selector for menu icons.
 * @type {string}
 */
export const MENU_ICON_SELECTOR = 'img.iZYCc';

/**
 * The class names used by the original sentence icon element.
 * @type {string[]}
 */
export const SENTENCE_ICON_CLASS_NAMES = [ 'FtLT3' ];

/**
 * The path of the close icon on the image CDN.
 * @type {string}
 */
export const CLOSE_ICON_CDN_PATH = 'images/x.svg';
