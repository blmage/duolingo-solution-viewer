import 'core-js/features/array/flat-map';
import 'core-js/features/object/from-entries';
import { h, render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import { it } from 'param.macro';
import sleep from 'sleep-promise';
import Cookies from 'js-cookie';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faEquals, faTimes, faQuestion } from '@fortawesome/free-solid-svg-icons';
import { faKey, faThumbtack } from '@fortawesome/pro-regular-svg-icons';
import { faArrowFromLeft, faArrowToRight } from '@fortawesome/pro-solid-svg-icons';
import { sendActionRequestToContentScript } from './ipc';

import {
  discardEvent,
  getUniqueElementId,
  isAnyInputFocused,
  isArray,
  isObject,
  logError,
  maxBy,
  noop,
  querySelectors,
  scrollElementIntoParentView,
  toggleElementDisplay,
} from './functions';

import {
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
  ACTION_TYPE_UPDATE_COMMENT_CHALLENGE_USER_REFERENCE,
  ACTION_TYPE_UPDATE_CURRENT_CHALLENGE_USER_REFERENCE,
  DEFAULT_LOCALE,
  EMPTY_CHALLENGE,
  EXTENSION_PREFIX,
  RESULT_CORRECT,
  RESULT_INCORRECT,
  UI_LISTENING_CHALLENGE_TYPES, UI_NAMING_CHALLENGE_TYPES,
  UI_TRANSLATION_CHALLENGE_TYPES,
} from './constants';

import { getTranslations } from './translations';
import * as Challenge from './challenges';
import * as Solution from './solutions';
import { CONTEXT_CHALLENGE, CONTEXT_FORUM } from './components';
import ChallengeSolutions from './components/ChallengeSolutions';
import ClosestSolution from './components/ClosestSolution';
import CorrectedAnswer from './components/CorrectedAnswer';
import Modal from './components/Modal';
import SolutionLink from './components/SolutionLink';

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
 * This is an attempt at avoiding flashes of contents and providing a consistent feedback to the user.
 *
 * @type {number}
 */
const MINIMUM_LOADING_DELAY = 250;

/**
 * @returns {string} The current locale used by the UI.
 */
function getUiLocale() {
  return String(window.duo?.uiLanguage || '').trim()
    || String(Cookies.get('ui_language') || '').trim()
    || DEFAULT_LOCALE;
}

/**
 * @returns {Promise<void>} A promise for when the UI is fully loaded.
 */
function onUiLoaded() {
  let cssLoadedPromise;

  if (isArray(window.duo?.stylesheets)) {
    cssLoadedPromise = new Promise(resolve => {
      // Regularly check if any of the stylesheets has been loaded
      // (the "stylesheets" array contain styles for both LTR and RTL directions).
      const checkInterval = setInterval(() => {
        const isCssLoaded = Array.from(document.styleSheets)
          .some(stylesheet => window.duo.stylesheets.some(href => String(stylesheet.href || '').indexOf(href) >= 0));

        if (isCssLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  } else {
    cssLoadedPromise = Promise.resolve();
  }

  return new Promise(resolve => {
    const callback = () => cssLoadedPromise.then(() => resolve());

    if ((document.readyState === 'complete') || (document.readyState === 'interactive')) {
      setTimeout(callback, 1);
    } else {
      document.addEventListener('DOMContentLoaded', callback);
    }
  });
}

/**
 * The UI elements used to wrap the different components rendered by the extension.
 *
 * @type {object.<string, Element>}
 */
const componentWrappers = {};

/**
 * @param {Function} component A UI component from the extension.
 * @param {Element} parentElement The parent element to which the wrapper should be appended.
 * @returns {Element} A wrapper element for the given UI component.
 */
function getComponentWrapper(component, parentElement) {
  if (!componentWrappers[component.name] || !componentWrappers[component.name].isConnected) {
    const wrapper = document.createElement('div');
    wrapper.id = getUniqueElementId(`${EXTENSION_PREFIX}-${component.name}-`);
    componentWrappers[component.name] = wrapper;
  }

  if (parentElement !== componentWrappers[component.name].parentElement) {
    parentElement.appendChild(componentWrappers[component.name]);
  }

  return componentWrappers[component.name];
}

/**
 * @returns {number} The height of the fixed forum page header, if any.
 */
const getForumTopScrollOffset = () => document.querySelector(FORUM_FIXED_PAGE_HEADER_SELECTOR)?.clientHeight;

/**
 * @param {import('./solutions.js').Solution} closestSolution A solution that comes closest to a user answer.
 * @param {string} result The result of the corresponding challenge.
 */
function renderChallengeClosestSolution(closestSolution, result) {
  try {
    const solutionWrapper = document.querySelector(CHALLENGE_SOLUTION_WRAPPER_SELECTOR);

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
}

/**
 * @param {import('./solutions.js').DiffToken[]} correctionDiff
 * A list of tokens representing the similarities and differences between a user answer and a solution.
 * @param {string} result The result of the corresponding challenge.
 */
function renderChallengeCorrectedAnswer(correctionDiff, result) {
  try {
    const solutionWrapper = document.querySelector(CHALLENGE_SOLUTION_WRAPPER_SELECTOR);

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
}

/**
 * @param {string} result The result of the challenge.
 */
function renderChallengeSolutionLoader(result) {
  try {
    const actionLinkList = document.querySelector(CHALLENGE_ACTION_LINK_LIST_SELECTOR);

    if (actionLinkList) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <SolutionLink result={result} isLoading={true} />
        </IntlProvider>,
        getComponentWrapper(SolutionLink, actionLinkList)
      );
    } else {
      throw new Error('Could not find the action link list element.');
    }
  } catch (error) {
    logError(error, 'Could not render the solution list loader: ');
  }
}

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
function renderChallengeSolutionListModal(challenge, result, userAnswer, opened) {
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
      const uiModalCloseButton = document.querySelector(CHALLENGE_MODAL_CLOSE_BUTTON_SELECTOR);

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
}

/**
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 */
function renderChallengeSolutionLink(challenge, result, userAnswer) {
  try {
    const actionLinkList = document.querySelector(CHALLENGE_ACTION_LINK_LIST_SELECTOR);

    if (actionLinkList) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <SolutionLink
            result={result}
            solutions={challenge.solutions}
            onClick={() => renderChallengeSolutionListModal(challenge, result, userAnswer, true).catch(noop)}
          />
        </IntlProvider>,
        getComponentWrapper(SolutionLink, actionLinkList)
      );
    } else {
      throw new Error('Could not find the action link list element.');
    }
  } catch (error) {
    logError(error, 'Could not render the solution list link: ');
  }
}

/**
 * @param {number} commentId The ID of a forum comment.
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} userReference The reference answer from the user.
 */
function renderForumCommentChallenge(commentId, challenge, userReference = '') {
  try {
    if (forumOpWrapper?.isConnected) {
      const actionLinkList = document.querySelector(FORUM_OP_ACTION_LINK_LIST_SELECTOR);

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
}

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
function getUserAnswer() {
  const blankFillingAnswer = document.querySelector(BLANK_FILLING_FULL_ANSWER_SELECTOR);
  let userAnswer = String(blankFillingAnswer?.textContent || '').trim();

  if ('' !== userAnswer) {
    // The user answer is enclosed within underscores, seemingly used for spacing.
    return userAnswer.replace(/_([^_]+)_/g, '$1');
  }

  const answerInput = document.querySelector(ANSWER_INPUT_SELECTOR);
  userAnswer = String(answerInput?.value || '').trim();

  if ('' === userAnswer) {
    const tokenContainer = document.querySelector(ANSWER_SELECTED_TOKEN_CONTAINER_SELECTOR)

    if (tokenContainer) {
      const tokens = Array.from(tokenContainer.querySelectorAll(ANSWER_SELECTED_TOKEN_SELECTOR));
      userAnswer = tokens.map(token => token.innerText.trim()).join(' ').normalize().trim();
    }
  }

  return userAnswer;
}

/**
 * @param {object} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @param {import('./solutions.js').DiffToken[]|null} correctionDiff
 * If a corrected version of the answer should be displayed,
 * a list of tokens representing the similarities and differences between this answer and a reference solution.
 * @returns {Promise<boolean>} A promise for whether the result of the challenge could be handled.
 */
async function handleChallengeResult(challenge, result, userAnswer, correctionDiff = null) {
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
}

/**
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {Promise<boolean>} A promise for whether the result of a translation challenge was successfully handled.
 */
async function handleTranslationChallengeResult(result, userAnswer) {
  const challengeWrapper = document.querySelector(TRANSLATION_CHALLENGE_WRAPPER);

  if (!challengeWrapper) {
    return false;
  }

  const statementWrapper = querySelectors(CHALLENGE_STATEMENT_SELECTORS);

  if (!statementWrapper) {
    return false;
  }

  const cleanWrapper = statementWrapper.cloneNode(true);
  const elementHints = cleanWrapper.querySelectorAll(CHALLENGE_STATEMENT_HINT_SELECTOR);

  if (elementHints.length > 0) {
    elementHints.forEach(hint => hint.parentNode.removeChild(hint));
  }

  let statement = cleanWrapper.innerText.trim();

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
}

/**
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {Promise<boolean>} A promise for whether the result of a listening challenge was successfully handled.
 */
async function handleListeningChallengeResult(result, userAnswer) {
  const challengeWrapper = document.querySelector(LISTENING_CHALLENGE_WRAPPER);

  if (!challengeWrapper) {
    return false;
  }

  const solutionTranslationWrapper = document.querySelector(CHALLENGE_SOLUTION_TRANSLATION_SELECTOR);

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
}

/**
 * @param {boolean} opened Whether the modal should be opened / closed.
 * @returns {Promise<void>} A promise for when the modal will have finished opening / closing.
 */
function renderCompletedChallengeSolutionListModal(opened) {
  return (null === completedChallenge)
    ? Promise.reject()
    : renderChallengeSolutionListModal(
      completedChallenge.challenge,
      completedChallenge.result,
      completedChallenge.userAnswer,
      opened
    );
}

/**
 * A RegExp for the URLs of forum comments.
 *
 * @type {RegExp}
 */
const FORUM_COMMENT_URL_REGEXP = /forum\.duolingo\.com\/comment\/(?<comment_id>[\d]+)/;

/**
 * @param {string} location The new location of the document.
 */
function handleDocumentLocationChange(location) {
  forumCommentId = null;
  forumCommentData = null;
  forumCommentChallengeWrapper = null;
  const matches = location.match(FORUM_COMMENT_URL_REGEXP);

  if (isArray(matches)) {
    const commentId = Number(matches[1]);

    if (commentId > 0) {
      forumCommentId = commentId;

      onUiLoaded()
        .then(() => Promise.race(
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
        ));
    }
  }
}

/**
 * Simulates a click on a footer button from the original UI.
 *
 * @param {string} iconSelector A CSS selector for the icon of the button.
 */
function clickOriginalUiFooterButton(iconSelector) {
  const button = document.querySelector(iconSelector)?.closest('button');
  button && renderCompletedChallengeSolutionListModal(false).then(() => button.click()).catch(noop);
}

/**
 * A mutation observer for the footer of the challenge screen, detecting and handling challenge results.
 *
 * @type {MutationObserver}
 */
const challengeFooterMutationObserver = new MutationObserver(() => {
  if (!challengeFooter) {
    return;
  }

  const newResultWrapper = challengeFooter.querySelector(RESULT_WRAPPER_SELECTOR);

  if (newResultWrapper !== resultWrapper) {
    resultWrapper = newResultWrapper;
    completedChallenge = null;

    if (null !== resultWrapper) {
      try {
        const userAnswer = getUserAnswer();

        const result = resultWrapper.classList.contains(RESULT_WRAPPER_CORRECT_CLASS_NAME)
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

// Opens the solution list modal when "S" is pressed, if relevant.
// Clicks the discussion button when "D" is pressed, if available.
document.addEventListener('keydown', event => {
  if (!event.ctrlKey && !isAnyInputFocused()) {
    const key = event.key.toLowerCase();

    if ('s' === key) {
      discardEvent(event);

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
        });
    } else if ('d' === key) {
      discardEvent(event);
      clickOriginalUiFooterButton(CHALLENGE_DISCUSSION_ICON_SELECTOR);
    } else if ('r' === key) {
      discardEvent(event);
      clickOriginalUiFooterButton(CHALLENGE_REPORT_ICON_SELECTOR);
    }
  }
});

// Detects and handles relevant changes to the document location or the UI.
setInterval(() => {
  if (document.location.href !== documentLocation) {
    documentLocation = document.location.href;
    handleDocumentLocationChange(documentLocation);
  }

  const newChallengeFooter = document.querySelector(CHALLENGE_FOOTER_SELECTOR);

  if (newChallengeFooter) {
    if (newChallengeFooter !== challengeFooter) {
      challengeFooter = newChallengeFooter;
      challengeFooterMutationObserver.disconnect();
      challengeFooterMutationObserver.observe(challengeFooter, { childList: true, subtree: true });
    }
  } else {
    completedChallenge = null;
  }

  const newForumOpWrapper = document.querySelector(FORUM_OP_WRAPPER_SELECTOR);

  if (newForumOpWrapper) {
    if (newForumOpWrapper !== forumOpWrapper) {
      forumOpWrapper = newForumOpWrapper;

      if (forumCommentData) {
        onUiLoaded()
          .then(() => renderForumCommentChallenge(
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
const TRANSLATION_CHALLENGE_WRAPPER = UI_TRANSLATION_CHALLENGE_TYPES
  .map(`[data-test^="challenge challenge-${it}"]`)
  .join(', ');

/**
 * A CSS selector for the wrapper of the current listening challenge.
 *
 * @type {string}
 */
const LISTENING_CHALLENGE_WRAPPER = UI_LISTENING_CHALLENGE_TYPES
  .map(`[data-test^="challenge challenge-${it}"]`)
  .join(', ');

/**
 * A CSS selector for the result wrapper of the current challenge screen.
 * It is currently the previous sibling of the wrapper of the "Continue" button.
 *
 * @type {string}
 */
const RESULT_WRAPPER_SELECTOR = '._1tuLI';

/**
 * The class name which is applied to the result wrapper when the user has given a correct answer.
 *
 * @type {string}
 */
const RESULT_WRAPPER_CORRECT_CLASS_NAME = '_3e9O1';

/**
 * Some of the possible CSS selectors for the statement of the current challenge (holding the sentence to translate),
 * ordered by priority.
 *
 * @type {string[]}
 */
const CHALLENGE_STATEMENT_SELECTORS = [
  '[data-test="hint-sentence"]',
  '[data-test="challenge-header"]',
  '[data-test="challenge-translate-prompt"]',
];

/**
 * A CSS selector for the hints added to the statement of the current challenge.
 *
 * @type {string}
 */
const CHALLENGE_STATEMENT_HINT_SELECTOR = '[data-test="hint-popover"]';

/**
 * A CSS selector for the translated solution of the current challenge.
 * In case it might help, the ClosestSolution component targets the same value.
 *
 * @type {string}
 */
const CHALLENGE_SOLUTION_TRANSLATION_SELECTOR = '._3mObn > *:last-child > ._1UqAr';

/**
 * A CSS selector for the different kinds of answer inputs that are not based on the word bank.
 *
 * @type {string}
 */
const ANSWER_INPUT_SELECTOR = [
  'input[data-test="challenge-text-input"]',
  'textarea[data-test="challenge-translate-input"]',
].join(', ');

/**
 * A CSS selector for the container of the full answer for fill-in-the-blank challenges.
 *
 * @type {string}
 */
const BLANK_FILLING_FULL_ANSWER_SELECTOR = '._2FKqf';

/**
 * A CSS selector for the container of the answer tokens selected from the word bank.
 *
 * @type {string}
 */
const ANSWER_SELECTED_TOKEN_CONTAINER_SELECTOR = '.PcKtj';

/**
 * A CSS selector for a answer token selected from the word bank.
 *
 * @type {string}
 */
const ANSWER_SELECTED_TOKEN_SELECTOR = '[data-test="challenge-tap-token"]';

/**
 * A CSS selector for the footer of the current challenge screen, holding the result and action elements.
 *
 * @type {string}
 */
const CHALLENGE_FOOTER_SELECTOR = '._2Fc1K';

/**
 * A CSS selector for the solution wrapper of the current challenge screen, holding the answer key to the challenge.
 *
 * @type {string}
 */
const CHALLENGE_SOLUTION_WRAPPER_SELECTOR = '._2ez4I';

/**
 * A CSS selector for the list of action links of the current challenge screen.
 *
 * @type {string}
 */
const CHALLENGE_ACTION_LINK_LIST_SELECTOR = '._2AOD4, ._3MD8I';

/**
 * A CSS selector for the report (flag) icon of the challenge screen.
 *
 * @type {string}
 */
const CHALLENGE_REPORT_ICON_SELECTOR = '._1NTcn, ._3cRbJ';

/**
 * A CSS selector for the discussion icon of the challenge screen.
 *
 * @type {string}
 */
const CHALLENGE_DISCUSSION_ICON_SELECTOR = '._1Gda2, ._1BpR_';

/**
 * A CSS selector for the close button of original modals on the challenge screen.
 *
 * @type {string}
 */
const CHALLENGE_MODAL_CLOSE_BUTTON_SELECTOR = '#overlays *[data-test="close-button"]';

/**
 * A CSS selector for the fixed page header used in the forum. We use the class names with the most styles.
 * Note that the fixed header is different on desktop and mobile.
 *
 * @type {string}
 */
const FORUM_FIXED_PAGE_HEADER_SELECTOR = '._2i8Km, ._13Hyj';

/**
 * A CSS selector for the wrapper of the original post in a forum discussion.
 *
 * @type {string}
 */
const FORUM_OP_WRAPPER_SELECTOR = '._3eQwU';

/**
 * A CSS selector for the list of actions related to the original post in a forum discussion.
 *
 * @type {string}
 */
const FORUM_OP_ACTION_LINK_LIST_SELECTOR = '._3Rqyw';
