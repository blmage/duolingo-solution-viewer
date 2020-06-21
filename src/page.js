import { h, render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import { isArray, maxBy } from 'lodash';
import sleep from 'sleep-promise';
import { CONTEXT_CHALLENGE, CONTEXT_FORUM } from './components/base';
import ChallengeSolutions from './components/ChallengeSolutions';
import ClosestSolution from './components/ClosestSolution';
import CorrectedAnswer from './components/CorrectedAnswer';
import Modal from './components/Modal';
import SolutionLink from './components/SolutionLink';

import {
  discardEvent,
  getSolutionDisplayableString,
  getUiLocale,
  getUniqueElementId,
  isInputFocused,
  isObject,
  logError,
  querySelectors,
  sendActionRequestToContentScript,
  toggleElement,
} from './functions';

import {
  ACTION_TYPE_GET_COMMENT_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
  ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE, ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER,
  ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE,
  EMPTY_CHALLENGE,
  EXTENSION_PREFIX,
  FORUM_COMMENT_URL_REGEXP,
  LISTENING_CHALLENGE_TYPES,
  RESULT_CORRECT,
  RESULT_INCORRECT,
  TRANSLATION_CHALLENGE_TYPES,
} from './constants';

import { getTranslations } from './translations';

/**
 * A minimum loading delay for the action requests to the background script.
 * This is an attempt at avoiding flashes of contents while providing a consistent feedback to the user.
 *
 * @type {number}
 */
const MINIMUM_LOADING_DELAY = 300;

/**
 * A CSS selector for the wrapper of the current translation challenge.
 *
 * @type {string}
 */
const TRANSLATION_CHALLENGE_WRAPPER = TRANSLATION_CHALLENGE_TYPES
  .map(type => `[data-test^="challenge challenge-${type}"]`)
  .join(', ');

/**
 * A CSS selector for the wrapper of the current listening challenge.
 *
 * @type {string}
 */
const LISTENING_CHALLENGE_WRAPPER = LISTENING_CHALLENGE_TYPES
  .map(type => `[data-test^="challenge challenge-${type}"]`)
  .join(', ');

/**
 * A CSS selector for the result wrapper of the current challenge screen.
 *
 * @type {string}
 */
const RESULT_WRAPPER_SELECTOR = '._1Ag8k';

/**
 * The class name which is applied to the result wrapper when the user has given a correct answer.
 *
 * @type {string}
 */
const RESULT_WRAPPER_CORRECT_CLASS_NAME = '_1WH_r';

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
 *
 * @type {string}
 */
const CHALLENGE_SOLUTION_TRANSLATION_SELECTOR = '.vpbSG > *:last-child > .TnCw3';

/**
 * A CSS selector for all the different kinds of answer input which are not based on the word bank.
 *
 * @type {string}
 */
const ANSWER_INPUT_SELECTOR = [
  'input[data-test="challenge-text-input"]',
  'textarea[data-test="challenge-translate-input"]',
].join(', ');

/**
 * A CSS selector for the container of the answer tokens selected from the word bank.
 *
 * @type {string}
 */
const ANSWER_SELECTED_TOKEN_CONTAINER_SELECTOR = '._3vVWl';

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
const CHALLENGE_FOOTER_SELECTOR = '._1obm2';

/**
 * A CSS selector for the solution wrapper of the current challenge screen, holding the answer key to the challenge.
 *
 * @type {string}
 */
const CHALLENGE_SOLUTION_WRAPPER_SELECTOR = '.vpbSG';

/**
 * A CSS selector for the list of action links of the current challenge screen.
 *
 * @type {string}
 */
const CHALLENGE_ACTION_LINK_LIST_SELECTOR = '._1Xpok';

/**
 * A CSS selector for the fixed page header used among other places in the forum.
 *
 * @type {string}
 */
const FORUM_FIXED_PAGE_HEADER_SELECTOR = '._2Jt0i, ._2i8Km';

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

  parentElement.appendChild(componentWrappers[component.name]);

  return componentWrappers[component.name];
}

/**
 * @param {import('./solutions.js').Solution} closestSolution A solution that is closest to a user answer.
 * @param {string} result The result of the corresponding challenge.
 */
function renderChallengeClosestSolution(closestSolution, result) {
  try {
    const solutionWrapper = document.querySelector(CHALLENGE_SOLUTION_WRAPPER_SELECTOR);

    if (solutionWrapper) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <ClosestSolution solution={getSolutionDisplayableString(closestSolution)} result={result} />
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
 * Whether a solution list modal is currently displayed.
 *
 * @type {boolean}
 */
let isSolutionListModalDisplayed = false;

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
 * @param {import('./background.js').Challenge} challenge A challenge.
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 */
function renderChallengeSolutionModal(challenge, result, userAnswer) {
  try {
    if (isSolutionListModalDisplayed) {
      return;
    }

    isSolutionListModalDisplayed = true;
    const currentResultWrapper = resultWrapper;
    const modalKey = new Date().getTime().toString();

    const updateUserAnswer = async newAnswer => {
      try {
        renderChallengeSolutionLoader(result);
        await sleep(MINIMUM_LOADING_DELAY);

        const data = challenge.commentId
          ? (
            await sendActionRequestToContentScript(
              ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE,
              {
                userReference: newAnswer,
                commentId: challenge.commentId,
              }
            )
          ) : (
            await sendActionRequestToContentScript(
              ACTION_TYPE_MATCH_CHALLENGE_WITH_USER_ANSWER,
              {
                challenge,
                userAnswer: newAnswer,
              }
            )
          );

        if (
          isObject(data)
          && isObject(data.challenge)
          && (currentResultWrapper === resultWrapper)
        ) {
          renderChallengeSolutionLink(data.challenge, result, newAnswer);
          return data.challenge.solutions || [];
        }
      } catch (error) {
        renderChallengeSolutionLink(challenge, result, userAnswer);
        error && logError(error, 'Could not update the user answer: ');
      }
    }

    const onModalClose = () => {
      isSolutionListModalDisplayed = false;
    };

    render(
      <IntlProvider definition={getTranslations(getUiLocale())}>
        <Modal key={modalKey} onClose={onModalClose}>
          <ChallengeSolutions context={CONTEXT_CHALLENGE}
                              {...challenge}
                              userReference={userAnswer}
                              onUserReferenceUpdate={updateUserAnswer} />
        </Modal>
      </IntlProvider>,
      getComponentWrapper(Modal, document.body)
    );
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
          <SolutionLink result={result}
                        solutions={challenge.solutions}
                        onClick={() => renderChallengeSolutionModal(challenge, result, userAnswer)} />
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
    if (forumOpWrapper && forumOpWrapper.isConnected) {
      const actionLinkList = document.querySelector(FORUM_OP_ACTION_LINK_LIST_SELECTOR);

      if (actionLinkList) {
        const challengeWrapper = getComponentWrapper(ChallengeSolutions, forumOpWrapper)

        if (0 === challengeWrapper.childNodes.length) {
          // Hide the challenge on the initial rendering.
          toggleElement(challengeWrapper, false);
        }

        const updateUserReference = async newReference => {
          try {
            await sleep(MINIMUM_LOADING_DELAY);

            const data = await sendActionRequestToContentScript(
              ACTION_TYPE_UPDATE_COMMENT_USER_REFERENCE,
              {
                commentId,
                userReference: newReference,
              }
            );

            if (
              isObject(data)
              && isObject(data.challenge)
              && (commentId === forumCommentId)
            ) {
              forumCommentData = data;
              return data.challenge.solutions || [];
            }
          } catch (error) {
            error && logError(error, 'Could not update the user reference: ');
          }
        }

        const getScrollOffset = () => {
          const pageHeader = document.querySelector(FORUM_FIXED_PAGE_HEADER_SELECTOR);
          return pageHeader ? pageHeader.clientHeight : 0;
        };

        render(
          <IntlProvider definition={getTranslations(getUiLocale() || challenge.fromLanguage)}>
            <ChallengeSolutions key={`forum-challenge-${commentId}`}
                                context={CONTEXT_FORUM}
                                solutions={challenge.solutions}
                                userReference={userReference}
                                onUserReferenceUpdate={updateUserReference}
                                getScrollOffset={getScrollOffset} />
          </IntlProvider>,
          challengeWrapper
        );

        render(
          <IntlProvider definition={getTranslations(getUiLocale())}>
            <SolutionLink context={CONTEXT_FORUM}
                          solutions={challenge.solutions}
                          onClick={() => toggleElement(challengeWrapper)} />
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
 * The last seen wrapping element for a challenge result.
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
  const answerInput = document.querySelector(ANSWER_INPUT_SELECTOR);
  let userAnswer = (answerInput && answerInput.value && String(answerInput.value).trim()) || '';

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
 * If a corrected version of the answer should be displayed, a list of tokens representing the similarities and
 * differences between this answer and a reference solution.
 * @returns {Promise<boolean>} Whether the result of the challenge could be handled.
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
      if (challenge.solutions.length > 1) {
        renderChallengeClosestSolution(maxBy(challenge.solutions, 'score'), result);
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
 * @returns {Promise<boolean>} A promise for whether the result of a translation challenge was handled.
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

  return sendActionRequestToContentScript(
    ACTION_TYPE_GET_CURRENT_TRANSLATION_CHALLENGE,
    {
      result,
      userAnswer,
      statement: cleanWrapper.innerText,
    }
  ).catch(() => false).then(challenge =>
    isObject(challenge) && handleChallengeResult(challenge, result, userAnswer)
  );
}

/**
 * @param {string} result The result of the challenge.
 * @param {string} userAnswer The answer given by the user.
 * @returns {Promise<boolean>} A promise for whether the result of a listening challenge was handled.
 */
async function handleListeningChallengeResult(result, userAnswer) {
  const challengeWrapper = document.querySelector(LISTENING_CHALLENGE_WRAPPER);

  if (!challengeWrapper) {
    return false;
  }

  const solutionTranslationWrapper = document.querySelector(CHALLENGE_SOLUTION_TRANSLATION_SELECTOR);

  if (!solutionTranslationWrapper) {
    return false;
  }

  return sendActionRequestToContentScript(
    ACTION_TYPE_GET_CURRENT_LISTENING_CHALLENGE,
    {
      result,
      userAnswer,
      solutionTranslation: solutionTranslationWrapper.innerText,
    }
  ).catch(() => false).then(data =>
    isObject(data)
    && isObject(data.challenge)
    && handleChallengeResult(data.challenge, result, userAnswer, data.correctionDiff)
  );
}

/**
 * @param {string} location The new location of the document.
 */
function handleDocumentLocationChange(location) {
  forumCommentId = null;
  forumCommentData = null;
  const matches = location.match(FORUM_COMMENT_URL_REGEXP);

  if (isArray(matches)) {
    const commentId = Number(matches[1]);

    if ((commentId > 0) && (commentId !== forumCommentId)) {
      forumCommentId = commentId;

      sendActionRequestToContentScript(
        ACTION_TYPE_GET_COMMENT_CHALLENGE,
        commentId
      ).then(data => {
        if (
          isObject(data)
          && isObject(data.challenge)
          && (forumCommentId === data.commentId)
        ) {
          forumCommentData = data;
          renderForumCommentChallenge(data.commentId, data.challenge, data.userReference);
        }
      }).catch(error => {
        error && logError(error, 'Could not handle the forum comment:');
      });
    }
  }
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
          .then(wasHandled =>
            wasHandled || handleTranslationChallengeResult(result, userAnswer)
          ).then(wasHandled =>
            wasHandled || renderChallengeSolutionLink(EMPTY_CHALLENGE, result, userAnswer)
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

document.addEventListener('keydown', event => {
  if (
    !event.ctrlKey
    && (null !== completedChallenge)
    && !isSolutionListModalDisplayed
    && !isInputFocused()
    && (event.key.toLowerCase() === 's')
  ) {
    discardEvent(event);

    renderChallengeSolutionModal(
      completedChallenge.challenge,
      completedChallenge.result,
      completedChallenge.userAnswer
    );
  }
});

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
        renderForumCommentChallenge(
          forumCommentData.commentId,
          forumCommentData.challenge,
          forumCommentData.userReference
        );
      }
    }
  }
}, 50);
