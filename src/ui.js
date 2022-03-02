import 'core-js/features/array/flat-map';
import 'core-js/features/object/from-entries';
import { h, render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import { it } from 'one-liner.macro';
import Cookies from 'js-cookie';
import { config as faConfig, library } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css'
import { faCheck, faEquals, faTimes, faQuestion } from '@fortawesome/free-solid-svg-icons';
import { faKey, faThumbtack } from '@fortawesome/pro-regular-svg-icons';
import { faArrowFromLeft, faArrowToRight } from '@fortawesome/pro-solid-svg-icons';
import { sendActionRequestToContentScript } from 'duo-toolbox/extension/ipc';
import { MUTEX_HOTKEYS, PRIORITY_HIGH, requestMutex } from 'duo-toolbox/extension/ui';
import { isArray, isObject, maxBy, noop, runPromiseForEffects, sleep } from 'duo-toolbox/utils/functions';
import { logError } from 'duo-toolbox/utils/logging';

import {
  getUniqueElementId,
  isAnyInputFocused,
  querySelectors,
  scrollElementIntoParentView,
  toggleElementDisplay,
} from 'duo-toolbox/utils/ui';

import { RESULT_CORRECT, RESULT_INCORRECT } from 'duo-toolbox/duo/challenges';
import { onUiLoaded } from 'duo-toolbox/duo/events';

import {
  DEFAULT_LOCALE,
  EMPTY_CHALLENGE,
  EXTENSION_PREFIX,
  UI_LISTENING_CHALLENGE_TYPES,
  UI_NAMING_CHALLENGE_TYPES,
  UI_TRANSLATION_CHALLENGE_TYPES,
} from './constants';

import {
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
} from './ipc';

import { getTranslations } from './translations';
import * as Challenge from './challenges';
import * as Solution from './solutions';
import { CONTEXT_CHALLENGE, CONTEXT_FORUM } from './components';
import ChallengeSolutions from './components/ChallengeSolutions';
import ClosestSolution from './components/ClosestSolution';
import CorrectedAnswer from './components/CorrectedAnswer';
import Modal from './components/Modal';
import SolutionLink from './components/SolutionLink';

// When using the default behavior, FA styles are not always properly added to the pages, resulting in huge icons.
faConfig.autoAddCss = false;

// Register the FontAwesome icons.
library.add(
  faArrowFromLeft,
  faArrowToRight,
  faCheck,
  faEquals,
  faKey,
  faQuestion,
  faThumbtack,
  faTimes
);

/**
 * A minimum loading delay for the action requests sent to the background script.
 *
 * This is an attempt at avoiding flashes of contents and providing a consistent feedback to the user.
 *
 * @type {number}
 */
const MINIMUM_LOADING_DELAY = 250;

/**
 * @returns {string} The current locale used by the UI.
 */
const getUiLocale = () => (
  String(window.duo?.uiLanguage || '').trim()
  || String(Cookies.get('ui_language') || '').trim()
  || DEFAULT_LOCALE
);

/**
 * The UI elements used to wrap the different components rendered by the extension.
 *
 * @type {object.<string, Element>}
 */
const componentWrappers = {};

/**
 * @param {Function} component A UI component from the extension.
 * @param {Element} parentElement The parent element to which the wrapper should be appended.
 * @param {object} styles A set of styles to apply to the wrapper.
 * @returns {Element} A wrapper element for the given UI component.
 */
const getComponentWrapper = (component, parentElement, styles = {}) => {
  if (!componentWrappers[component.name] || !componentWrappers[component.name].isConnected) {
    const wrapper = document.createElement('div');
    wrapper.id = getUniqueElementId(`${EXTENSION_PREFIX}-${component.name}-`);
    componentWrappers[component.name] = wrapper;
  }

  if (parentElement !== componentWrappers[component.name].parentElement) {
    parentElement.appendChild(componentWrappers[component.name]);
  }

  for (const [ key, value ] of Object.entries(styles)) {
    componentWrappers[component.name].style[key] = value;
  }

  return componentWrappers[component.name];
};

/**
 * @returns {number} The height of the fixed forum page header, if any.
 */
const getForumTopScrollOffset = () => document.querySelector(SELECTOR_FORUM_FIXED_PAGE_HEADER)?.clientHeight;

/**
 * @param {import('./solutions.js').Solution} closestSolution A solution that comes closest to a user answer.
 * @param {string} result The result of the corresponding challenge.
 * @returns {void}
 */
const renderChallengeClosestSolution = (closestSolution, result) => {
  try {
    const solutionWrapper = document.querySelector(SELECTOR_CHALLENGE_SOLUTION_WRAPPER);

    if (solutionWrapper) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <ClosestSolution solution={Solution.getReaderFriendlySummary(closestSolution)} result={result} />
        </IntlProvider>,
        getComponentWrapper(ClosestSolution, solutionWrapper)
      );
    } else {
      throw new Error('Could not find the solution wrapper element.');
    }
  } catch (error) {
    logError(error, 'Could not render the closest solution: ');
  }
};

/**
 * @param {import('./solutions.js').DiffToken[]} correctionDiff
 * A list of tokens representing the similarities and differences between a user answer and a solution.
 * @param {string} result The result of the corresponding challenge.
 * @returns {void}
 */
const renderChallengeCorrectedAnswer = (correctionDiff, result) => {
  try {
    const solutionWrapper = document.querySelector(SELECTOR_CHALLENGE_SOLUTION_WRAPPER);

    if (solutionWrapper) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <CorrectedAnswer diffTokens={correctionDiff} result={result} />
        </IntlProvider>,
        getComponentWrapper(CorrectedAnswer, solutionWrapper)
      );
    } else {
      throw new Error('Could not find the solution wrapper element.');
    }
  } catch (error) {
    logError(error, 'Could not render the corrected answer: ');
  }
};

/**
 * @param {string} result The result of the challenge.
 * @returns {void}
 */
const renderChallengeSolutionLoader = (result) => {
  try {
    const actionLinkList = document.querySelector(SELECTOR_CHALLENGE_ACTION_LINK_LIST);

    if (actionLinkList) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <SolutionLink result={result} isLoading={true} />
        </IntlProvider>,
        getComponentWrapper(SolutionLink, actionLinkList, { display: 'inherit' })
      );
    } else {
      throw new Error('Could not find the action link list element.');
    }
  } catch (error) {
    logError(error, 'Could not render the solution list loader: ');
  }
};

/**
 * Whether a solution list modal is currently being toggled off / on.
 *
 * @type {boolean}
 */
let isSolutionListModalToggling = false;

/**
 * Whether a solution list modal is currently displayed.
 *
 * @type {boolean}
 */
let isSolutionListModalDisplayed = false;

/**
 * The element in which are displayed the solutions of the challenge corresponding to the current forum discussion.
 *
 * @type {Element}
 */
let forumCommentChallengeWrapper = null;

/**
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @param {boolean} opened Whether the modal should be opened / closed.
 * @returns {Promise<void>} A promise for when the modal will have finished opening / closing.
 */
const renderChallengeSolutionListModal = (challenge, result, userAnswer, opened) => {
  try {
    if (isSolutionListModalToggling) {
      return Promise.reject();
    } else if (
      (isSolutionListModalDisplayed && opened)
      || (!isSolutionListModalDisplayed && !opened)
    ) {
      return Promise.resolve();
    }

    const currentResultWrapper = resultWrapper;

    const updateUserReference = async userReference => {
      try {
        renderChallengeSolutionLoader(result);

        await sleep(MINIMUM_LOADING_DELAY);

        const data = await sendActionRequestToContentScript(ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE, {
          userReference,
          key: Challenge.getUniqueKey(challenge),
        });

        if (isObject(data?.challenge) && (currentResultWrapper === resultWrapper)) {
          renderChallengeSolutionLink(data.challenge, result, data.userReference || userReference);

          if (isObject(completedChallenge)) {
            completedChallenge.userAnswer = data.userReference || userReference;
          }

          return data.challenge.solutions || [];
        }
      } catch (error) {
        renderChallengeSolutionLink(challenge, result, userAnswer);
        error && logError(error, 'Could not update the user answer: ');
      }
    };

    isSolutionListModalToggling = true;

    return new Promise(resolve => {
      const uiModalCloseButton = document.querySelector(SELECTOR_CHALLENGE_MODAL_CLOSE_BUTTON);

      if (uiModalCloseButton) {
        uiModalCloseButton.click();
        sleep(300).then(resolve);
        return;
      }

      resolve();
    }).finally(() => new Promise((resolve, reject) => {
      const onRequestClose = () => {
        if (isSolutionListModalDisplayed) {
          isSolutionListModalToggling = true;
          toggleModal(false);
        }
      }

      const onAfterOpen = () => {
        isSolutionListModalToggling = false;
        isSolutionListModalDisplayed = true;
        opened ? resolve() : reject();
      };

      const onAfterClose = () => {
        releaseHotkeysMutex();
        isSolutionListModalToggling = false;
        isSolutionListModalDisplayed = false;
        opened ? reject() : resolve();
      };

      const toggleModal = opened => render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <Modal
            opened={opened}
            onRequestClose={onRequestClose}
            onAfterOpen={onAfterOpen}
            onAfterClose={onAfterClose}
          >
            <ChallengeSolutions
              context={CONTEXT_CHALLENGE}
              {...challenge}
              userReference={userAnswer}
              onUserReferenceUpdate={updateUserReference}
            />
          </Modal>
        </IntlProvider>,
        getComponentWrapper(Modal, document.body)
      );

      toggleModal(opened);
    }));
  } catch (error) {
    logError(error, 'Could not render the solution list modal: ');
  }
};

/**
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {void}
 */
const renderChallengeSolutionLink = (challenge, result, userAnswer) => {
  try {
    const actionLinkList = document.querySelector(SELECTOR_CHALLENGE_ACTION_LINK_LIST);

    if (actionLinkList) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <SolutionLink
            result={result}
            solutions={challenge.solutions}
            onClick={() => renderChallengeSolutionListModal(challenge, result, userAnswer, true).catch(noop)}
          />
        </IntlProvider>,
        getComponentWrapper(SolutionLink, actionLinkList, { display: 'inherit' })
      );
    } else {
      throw new Error('Could not find the action link list element.');
    }
  } catch (error) {
    logError(error, 'Could not render the solution list link: ');
  }
};

/**
 * @param {number} commentId The ID of a forum comment.
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} userReference The reference answer from the user.
 * @returns {void}
 */
const renderForumCommentChallenge = (commentId, challenge, userReference = '') => {
  try {
    if (forumOpWrapper?.isConnected) {
      const actionLinkList = document.querySelector(SELECTOR_FORUM_OP_ACTION_LINK_LIST);

      if (actionLinkList) {
        forumCommentChallengeWrapper = getComponentWrapper(ChallengeSolutions, forumOpWrapper);

        if (0 === forumCommentChallengeWrapper.childNodes.length) {
          // Hide the challenge on the initial rendering.
          toggleElementDisplay(forumCommentChallengeWrapper, false);
        }

        const updateUserReference = async newReference => {
          try {
            await sleep(MINIMUM_LOADING_DELAY);

            const data = await sendActionRequestToContentScript(ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE, {
              commentId,
              userReference: newReference,
            });

            if (isObject(data?.challenge) && (commentId === forumCommentId)) {
              forumCommentData = data;
              return data.challenge.solutions || [];
            }
          } catch (error) {
            error && logError(error, 'Could not update the user reference: ');
          }
        }

        render(
          <IntlProvider definition={getTranslations(getUiLocale() || challenge.fromLanguage)}>
            <ChallengeSolutions
              key={`forum-challenge-${commentId}`}
              context={CONTEXT_FORUM}
              solutions={challenge.solutions}
              matchingData={challenge.matchingData}
              userReference={userReference}
              onUserReferenceUpdate={updateUserReference}
              scrollOffsetGetter={getForumTopScrollOffset}
            />
          </IntlProvider>,
          forumCommentChallengeWrapper
        );

        render(
          <IntlProvider definition={getTranslations(getUiLocale())}>
            <SolutionLink
              context={CONTEXT_FORUM}
              solutions={challenge.solutions}
              onClick={() => toggleElementDisplay(forumCommentChallengeWrapper)}
            />
          </IntlProvider>,
          getComponentWrapper(SolutionLink, actionLinkList)
        );
      } else {
        throw new Error('Could not find the action link list element.');
      }
    }
  } catch (error) {
    logError(error, 'Could not render the solution list: ');
  }
};

/**
 * The last seen document location.
 *
 * @type {string|null}
 */
let documentLocation = null;

/**
 * The last seen footer element on a challenge screen.
 *
 * @type {Element|null}
 */
let challengeFooter = null;

/**
 * The last seen wrapper element for a challenge result.
 *
 * @type {Element|null}
 */
let resultWrapper = null;

/**
 * The last completed challenge.
 *
 * @type {object|null}
 */
let completedChallenge = null;

/**
 * The last seen wrapping element of an original post in a forum discussion.
 *
 * @type {Element|null}
 */
let forumOpWrapper = null;

/**
 * The ID of the forum comment that is currently being displayed, if any.
 *
 * @type {number|null}
 */
let forumCommentId = null;

/**
 * Some data about the challenge discussed by the forum comment that is currently being displayed.
 *
 * @type {object|null}
 */
let forumCommentData = null;

/**
 * @returns {string} The current user answer.
 */
const getUserAnswer = () => {
  const blankFillingAnswer = document.querySelector(SELECTOR_BLANK_FILLING_FULL_ANSWER);
  let userAnswer = String(blankFillingAnswer?.textContent || '').trim();

  if ('' !== userAnswer) {
    // The user answer is enclosed within underscores, seemingly used for spacing.
    return userAnswer.replace(/_([^_]+)_/g, '$1');
  }

  const answerInput = document.querySelector(SELECTOR_ANSWER_INPUT);
  userAnswer = String(answerInput?.value || '').trim();

  if ('' === userAnswer) {
    const tokenContainer = document.querySelector(SELECTOR_ANSWER_SELECTED_TOKEN_CONTAINER)

    if (tokenContainer) {
      const tokens = Array.from(tokenContainer.querySelectorAll(SELECTOR_ANSWER_SELECTED_TOKEN));
      userAnswer = tokens.map(token => token.innerText.trim()).join(' ').normalize().trim();
    }
  }

  return userAnswer;
};

/**
 * @param {object} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @param {import('./solutions.js').DiffToken[]|null} correctionDiff
 * If a corrected version of the answer should be displayed,
 * a list of tokens representing the similarities and differences between this answer and a reference solution.
 * @returns {Promise<boolean>} A promise for whether the result of the challenge could be handled.
 */
const handleChallengeResult = async (challenge, result, userAnswer, correctionDiff = null) => {
  await sleep(MINIMUM_LOADING_DELAY);

  if (!challengeFooter) {
    // We have already passed to the next challenge.
    return true;
  }

  completedChallenge = { challenge, result, userAnswer };

  if (userAnswer) {
    if (RESULT_INCORRECT === result) {
      if (
        (challenge.solutions.length > 1)
        && challenge.solutions.some('score' in it)
      ) {
        renderChallengeClosestSolution(maxBy(challenge.solutions, it.score), result);
      }
    } else if (isArray(correctionDiff)) {
      renderChallengeCorrectedAnswer(correctionDiff, result);
    }
  }

  renderChallengeSolutionLink(challenge, result, userAnswer);

  return true;
};

/**
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {Promise<boolean>} A promise for whether the result of a translation challenge was successfully handled.
 */
const handleTranslationChallengeResult = async (result, userAnswer) => {
  const challengeWrapper = document.querySelector(SELECTOR_TRANSLATION_CHALLENGE_WRAPPER);

  if (!challengeWrapper) {
    return false;
  }

  const statementWrapper = querySelectors(SELECTORS_CHALLENGE_STATEMENT);

  if (!statementWrapper) {
    return false;
  }

  let statement = (
    !statementWrapper.matches(SELECTOR_CHALLENGE_STATEMENT_HINT_TOKEN)
      ? statementWrapper
      : statementWrapper.parentNode
  ).innerText.trim();

  const isNamingChallenge = UI_NAMING_CHALLENGE_TYPES.some(
    type => challengeWrapper.matches(`[data-test~="challenge-${type}"]`)
  );

  if (isNamingChallenge) {
    // The actual statement is contained within a sentence that looks like: "Write “the boys” in French".
    const [ , named ] = statement.match(/[\p{Pi}]([^\p{Pf}]+)[\p{Pf}]/u) || [];
    named && (statement = named);
  }

  return sendActionRequestToContentScript(
    ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
    {
      result,
      statement,
      userAnswer,
    }
  ).catch(() => false).then(challenge => (
    isObject(challenge) && handleChallengeResult(challenge, result, userAnswer)
  ));
};

/**
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {Promise<boolean>} A promise for whether the result of a listening challenge was successfully handled.
 */
const handleListeningChallengeResult = async (result, userAnswer) => {
  const challengeWrapper = document.querySelector(SELECTOR_LISTENING_CHALLENGE_WRAPPER);

  if (!challengeWrapper) {
    return false;
  }

  const solutionTranslationWrapper = document.querySelector(SELECTOR_CHALLENGE_SOLUTION_TRANSLATION);

  return sendActionRequestToContentScript(
    ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
    {
      result,
      userAnswer,
      solutionTranslation: !solutionTranslationWrapper
        ? null
        : solutionTranslationWrapper.innerText.trim(),
    }
  ).catch(() => false).then(data => (
    isObject(data?.challenge)
    && handleChallengeResult(data.challenge, result, userAnswer, data.correctionDiff)
  ));
};

/**
 * @param {boolean} opened Whether the modal should be opened / closed.
 * @returns {Promise<void>} A promise for when the modal will have finished opening / closing.
 */
const renderCompletedChallengeSolutionListModal = opened => (
  (null === completedChallenge)
    ? Promise.reject()
    : renderChallengeSolutionListModal(
      completedChallenge.challenge,
      completedChallenge.result,
      completedChallenge.userAnswer,
      opened
    )
);

/**
 * A RegExp for the URLs of forum comments.
 *
 * @type {RegExp}
 */
const FORUM_COMMENT_URL_REGEXP = /forum\.duolingo\.com\/comment\/(?<comment_id>[\d]+)/;

/**
 * @param {string} location The new location of the document.
 * @returns {void}
 */
const handleDocumentLocationChange = location => {
  forumCommentId = null;
  forumCommentData = null;
  forumCommentChallengeWrapper = null;
  const matches = location.match(FORUM_COMMENT_URL_REGEXP);

  if (isArray(matches)) {
    const commentId = Number(matches[1]);

    if (commentId > 0) {
      forumCommentId = commentId;

      onUiLoaded(() => runPromiseForEffects(
        Promise.race(
          [ 0, 1, 3, 6 ].map(async delay => {
            await sleep(delay * 1000);

            if (null !== forumCommentData) {
              return;
            }

            await sendActionRequestToContentScript(ACTION_TYPE_GET_COMMENT_CHALLENGE, commentId)
              .then(data => {
                if (isObject(data?.challenge) && (forumCommentId === data.commentId)) {
                  forumCommentData = data;

                  renderForumCommentChallenge(
                    data.commentId,
                    data.challenge,
                    data.userReference
                  );
                }
              })
              .catch(error => error && logError(error, 'Could not handle the forum comment:'))
          })
        )
      ));
    }
  }
};

/**
 * @returns {boolean} Whether a modal is currently displayed.
 */
const isAnyModalDisplayed = () => !!document.querySelector(SELECTOR_VISIBLE_MODAL_OVERLAY);

/**
 * Simulates a click on a footer button from the original UI.
 *
 * @param {string} iconSelector A CSS selector for the icon of the button.
 * @returns {void}
 */
const clickOriginalUiFooterButton = iconSelector => {
  const button = document.querySelector(iconSelector)?.closest('button');
  button && renderCompletedChallengeSolutionListModal(false).finally(() => button.click());
};

/**
 * A mutation observer for the footer of the challenge screen, detecting and handling challenge results.
 *
 * @type {MutationObserver}
 */
const challengeFooterMutationObserver = new MutationObserver(() => {
  if (!challengeFooter) {
    return;
  }

  const newResultWrapper = challengeFooter.querySelector(SELECTOR_RESULT_WRAPPER);

  if (newResultWrapper !== resultWrapper) {
    resultWrapper = newResultWrapper;
    completedChallenge = null;

    if (null !== resultWrapper) {
      try {
        const userAnswer = getUserAnswer();

        const result = resultWrapper.classList.contains(CLASS_NAME_CORRECT_RESULT_WRAPPER)
          ? RESULT_CORRECT
          : RESULT_INCORRECT;

        renderChallengeSolutionLoader(result);

        handleListeningChallengeResult(result, userAnswer)
          .then(
            wasHandled => wasHandled || handleTranslationChallengeResult(result, userAnswer)
          ).then(
          wasHandled => wasHandled || renderChallengeSolutionLink(EMPTY_CHALLENGE, result, userAnswer)
        ).catch(error => {
          renderChallengeSolutionLink(EMPTY_CHALLENGE, result, userAnswer);
          throw error;
        });
      } catch (error) {
        logError(error, 'Could not handle the challenge result: ');
      }
    }
  }
});

/**
 * A promise for if and when the hotkeys mutex will have been acquired, when a request is pending.
 *
 * @type {Promise|null}
 */
let hotkeysMutexPromise = null;

/**
 * A callback usable to release the hotkeys mutex, once it has been acquired.
 *
 * @type {Function|null}
 */
let hotkeysMutexReleaseCallback = null;

/**
 * Attempts to acquire the hotkeys mutex in a short delay.
 *
 * If the mutex is requested with a higher priority by another extension,
 * it will only be released if no modal is currently displayed.
 *
 * @returns {Promise<void>} A promise for if and when the hotkeys mutex has been acquired.
 */
const acquireHotkeysMutex = () => {
  if (hotkeysMutexReleaseCallback) {
    return Promise.resolve()
  }

  if (hotkeysMutexPromise) {
    return hotkeysMutexPromise;
  }

  hotkeysMutexPromise = requestMutex(
    MUTEX_HOTKEYS,
    {
      timeoutDelay: 20,
      priority: PRIORITY_HIGH,
      onSupersessionRequest: () => (
        !isAnyModalDisplayed()
        && hotkeysMutexReleaseCallback
        && hotkeysMutexReleaseCallback()
      ),
    }
  )
    .then(callback => {
      hotkeysMutexReleaseCallback = callback;
    })
    .finally(() => {
      hotkeysMutexPromise = null;
    });

  return hotkeysMutexPromise;
}

/**
 * Releases the hotkeys mutex, if it had been previously acquired.
 *
 * @returns {void}
 */
const releaseHotkeysMutex = () => {
  if (hotkeysMutexReleaseCallback) {
    hotkeysMutexReleaseCallback();
    hotkeysMutexReleaseCallback = null;
  }
};

// Opens the solution list modal when "S" is pressed, if relevant.
// Clicks the discussion button when "D" is pressed, if available.
// Clicks the report button when "R" is pressed, if available.
document.addEventListener('keydown', event => {
  if (!event.ctrlKey && !event.metaKey && !isAnyInputFocused()) {
    const key = event.key.toLowerCase();
    let callback = null;

    if ('s' === key) {
      callback = () => (
        renderCompletedChallengeSolutionListModal(true)
          .catch(() => {
            if (forumCommentChallengeWrapper) {
              toggleElementDisplay(forumCommentChallengeWrapper, true);

              scrollElementIntoParentView(
                forumCommentChallengeWrapper,
                getForumTopScrollOffset() + 10,
                'smooth'
              );
            }

            releaseHotkeysMutex();
          })
      );
    } else if ('r' === key) {
      callback = () => {
        clickOriginalUiFooterButton(SELECTOR_CHALLENGE_REPORT_ICON);
        releaseHotkeysMutex();
      };
    } else if ('d' === key) {
      callback = () => {
        clickOriginalUiFooterButton(SELECTOR_CHALLENGE_DISCUSSION_ICON);
        releaseHotkeysMutex();
      };
    }

    if (null !== callback) {
      acquireHotkeysMutex().then(callback);
    }
  }
});

// Detects and handles relevant changes to the document location or to the UI.
setInterval(() => {
  if (document.location.href !== documentLocation) {
    documentLocation = document.location.href;
    handleDocumentLocationChange(documentLocation);
  }

  const newChallengeFooter = document.querySelector(SELECTOR_CHALLENGE_FOOTER);

  if (newChallengeFooter) {
    if (newChallengeFooter !== challengeFooter) {
      challengeFooter = newChallengeFooter;
      challengeFooterMutationObserver.disconnect();
      challengeFooterMutationObserver.observe(challengeFooter, { childList: true, subtree: true });
    }
  } else {
    completedChallenge = null;
  }

  const newForumOpWrapper = document.querySelector(SELECTOR_FORUM_OP_WRAPPER);

  if (newForumOpWrapper) {
    if (newForumOpWrapper !== forumOpWrapper) {
      forumOpWrapper = newForumOpWrapper;

      if (forumCommentData) {
        onUiLoaded(() => renderForumCommentChallenge(
          forumCommentData.commentId,
          forumCommentData.challenge,
          forumCommentData.userReference
        ));
      }
    }
  }
}, 50);

/**
 * A CSS selector for the wrapper of the current translation challenge.
 *
 * @type {string}
 */
const SELECTOR_TRANSLATION_CHALLENGE_WRAPPER = UI_TRANSLATION_CHALLENGE_TYPES
  .map(`[data-test^="challenge challenge-${it}"]`)
  .join(', ');

/**
 * A CSS selector for the wrapper of the current listening challenge.
 *
 * @type {string}
 */
const SELECTOR_LISTENING_CHALLENGE_WRAPPER = UI_LISTENING_CHALLENGE_TYPES
  .map(`[data-test^="challenge challenge-${it}"]`)
  .join(', ');

/**
 * A CSS selector for the result wrapper of the current challenge screen.
 * It is currently the previous sibling of the wrapper of the "Continue" button.
 *
 * @type {string}
 */
const SELECTOR_RESULT_WRAPPER = '._1tuLI';

/**
 * The class name which is applied to the result wrapper when the user has given a correct answer.
 *
 * @type {string}
 */
const CLASS_NAME_CORRECT_RESULT_WRAPPER = '_3e9O1';

/**
 * A CSS selector for the words in the current challenge statement.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_STATEMENT_HINT_TOKEN = '[data-test="hint-token"]';

/**
 * A CSS selector for the hints added to words in the current challenge statement.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_STATEMENT_HINT_POPOVER = '[data-test="hint-popover"]'; // eslint-disable-line no-unused-vars

/**
 * Some of the possible CSS selectors for the statement of the current challenge (holding the sentence to translate),
 * ordered by priority.
 *
 * @type {string[]}
 */
const SELECTORS_CHALLENGE_STATEMENT = [
  '[data-test="hint-sentence"]',
  SELECTOR_CHALLENGE_STATEMENT_HINT_TOKEN,
  '[data-test="challenge-header"]',
  '[data-test="challenge-translate-prompt"]',
];

/**
 * A CSS selector for the translated solution of the current challenge.
 * In case it might help, the ClosestSolution component targets the same value.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_SOLUTION_TRANSLATION = '._3mObn > *:last-child > ._1UqAr';

/**
 * A CSS selector for the different kinds of answer inputs that are not based on the word bank.
 *
 * @type {string}
 */
const SELECTOR_ANSWER_INPUT = [
  'input[data-test="challenge-text-input"]',
  'textarea[data-test="challenge-translate-input"]',
].join(', ');

/**
 * A CSS selector for the container of the full answer for fill-in-the-blank challenges.
 *
 * @type {string}
 */
const SELECTOR_BLANK_FILLING_FULL_ANSWER = '._2FKqf';

/**
 * A CSS selector for the container of the answer tokens selected from the word bank.
 *
 * @type {string}
 */
const SELECTOR_ANSWER_SELECTED_TOKEN_CONTAINER = '.PcKtj';

/**
 * A CSS selector for a answer token selected from the word bank.
 *
 * @type {string}
 */
const SELECTOR_ANSWER_SELECTED_TOKEN = '[data-test="challenge-tap-token"]';

/**
 * A CSS selector for the footer of the current challenge screen, holding the result and action elements.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_FOOTER = '._2Fc1K';

/**
 * A CSS selector for the solution wrapper of the current challenge screen, holding the answer key to the challenge.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_SOLUTION_WRAPPER = '._2ez4I';

/**
 * A CSS selector for the list of action links of the current challenge screen.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_ACTION_LINK_LIST = '._3MD8I';

/**
 * A CSS selector for the report (flag) icon of the challenge screen.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_REPORT_ICON = '._1NTcn, ._3cRbJ, ._3tFbb, ._1SnxH';

/**
 * A CSS selector for the discussion icon of the challenge screen.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_DISCUSSION_ICON = '._1Gda2, ._1BpR_, ._2oQNn, ._3o1ZL';

/**
 * A CSS selector for the close button of original modals on the challenge screen.
 *
 * @type {string}
 */
const SELECTOR_CHALLENGE_MODAL_CLOSE_BUTTON = '#overlays *[data-test="close-button"]';

/**
 * A CSS selector for the fixed page header used in the forum. We use the class names with the most styles.
 * Note that the fixed header is different on desktop and mobile.
 *
 * @type {string}
 */
const SELECTOR_FORUM_FIXED_PAGE_HEADER = '._2i8Km, ._13Hyj';

/**
 * A CSS selector for the wrapper of the original post in a forum discussion.
 *
 * @type {string}
 */
const SELECTOR_FORUM_OP_WRAPPER = '._3eQwU';

/**
 * A CSS selector for the list of actions related to the original post in a forum discussion.
 *
 * @type {string}
 */
const SELECTOR_FORUM_OP_ACTION_LINK_LIST = '._3Rqyw';

/**
 * A CSS selector for a modal overlay that is visible.
 *
 * @type {string}
 */
const SELECTOR_VISIBLE_MODAL_OVERLAY = '._1tTsl:not(._1edTR)';
