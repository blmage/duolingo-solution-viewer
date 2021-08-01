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
 * A match type for strings that are not present in others.
 *
 * @type {number}
 */
export const STRING_MATCH_TYPE_NONE = 0b0000;

/**
 * A match type for strings that are present anywhere in others.
 *
 * @type {number}
 */
export const STRING_MATCH_TYPE_ANYWHERE = 0b0001;

/**
 * A match type for strings that are present at the start of others.
 *
 * @type {number}
 */
export const STRING_MATCH_TYPE_START = 0b0011;

/**
 * A match type for strings that are present at the end of others.
 *
 * @type {number}
 */
export const STRING_MATCH_TYPE_END = 0b0101;

/**
 * A match type for strings that are equal to others.
 *
 * @type {number}
 */
export const STRING_MATCH_TYPE_EXACT = 0b1111;

/**
 * A match mode for matching strings globally.
 *
 * @type {string}
 */
export const STRING_MATCH_MODE_GLOBAL = 'global';

/**
 * A match mode for matching strings based on the words they contain.
 *
 * @type {string}
 */
export const STRING_MATCH_MODE_WORDS = 'words';

/**
 * The URL of the image CDN as was last seen, usable as a fallback.
 *
 * @type {string}
 */
export const IMAGE_CDN_DEFAULT_BASE_URL = 'https://d35aaqx5ub95lt.cloudfront.net/';
