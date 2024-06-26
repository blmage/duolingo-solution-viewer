import { _ } from 'one-liner.macro';
import { sendEventNotificationToContentScript } from 'duo-toolbox/extension/ipc';

import {
  onPracticeChallengesLoaded,
  onSoundPlaybackRequested,
} from 'duo-toolbox/duo/events';

import {
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
} from './ipc';

onPracticeChallengesLoaded(
  sendEventNotificationToContentScript(UI_EVENT_TYPE_SESSION_LOADED, _)
);

onSoundPlaybackRequested(
  sendEventNotificationToContentScript(UI_EVENT_TYPE_SOUND_PLAYED, _?.url)
);
