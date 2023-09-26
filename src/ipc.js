/**
 * @type {string}
 */
export const ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE = 'get_current_translation_challenge';

/**
 * @type {string}
 */
export const ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE = 'get_current_listening_challenge';

/**
 * @type {string}
 */
export const ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE = 'update_current_challenge_user_reference';

/**
 * @type {string[]}
 */
export const ACTION_TYPES = [
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
];

/**
 * @type {string}
 */
export const UI_EVENT_TYPE_SESSION_LOADED = 'session_loaded';

/**
 * The type of the event occurring when a sound is played.
 * @type {string}
 */
export const UI_EVENT_TYPE_SOUND_PLAYED = 'sound_played';

/**
 * The types of the different events that can occur on the UI and are meaningful to the extension.
 * @type {string[]}
 */
export const UI_EVENT_TYPES = [
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
];
