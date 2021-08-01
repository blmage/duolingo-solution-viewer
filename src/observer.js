import { _ } from 'one-liner.macro';
import { sendEventNotificationToContentScript } from 'duo-toolbox/extension/ipc';

import {
  onForumDiscussionLoaded,
  onPracticeChallengesLoaded,
  onSoundPlaybackRequested,
} from 'duo-toolbox/duo/events';

import {
  UI_EVENT_TYPE_DISCUSSION_LOADED,
  UI_EVENT_TYPE_SESSION_LOADED,
  UI_EVENT_TYPE_SOUND_PLAYED,
} from './ipc';

onPracticeChallengesLoaded(
  sendEventNotificationToContentScript(UI_EVENT_TYPE_SESSION_LOADED, _)
);

onForumDiscussionLoaded(data => {
  if (
    (data.id > 0)
    && !!data.sentence_id
    && !!data.translation_language
  ) {
    sendEventNotificationToContentScript(UI_EVENT_TYPE_DISCUSSION_LOADED, {
      commentId: Number(data.id),
      discussionId: String(data.sentence_id).trim(),
      locale: String(data.translation_language).trim(),
    });
  }
});

// todo replace this with UI_EVENT_TYPE_TTS_SENTENCE_PLAYED

onSoundPlaybackRequested(
  sendEventNotificationToContentScript(UI_EVENT_TYPE_SOUND_PLAYED, _?.url)
);
