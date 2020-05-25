import { h, render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import lodash from 'lodash';
import { _, it, lift } from 'param.macro';
import ClosestSolution from './components/ClosestSolution';
import SolutionListLink from './components/SolutionListLink';
import SolutionListModal from './components/SolutionListModal';
import { EXTENSION_PREFIX, RESULT_CORRECT, RESULT_INCORRECT, TRANSLATION_CHALLENGE_TYPES } from './constants';
import * as solution from './functions';
import { getUiLocale, getUniqueElementId, logError } from './functions';
import { getTranslations } from './translations';

/**
 * A translation challenge.
 * @typedef {Object} Challenge
 * @property {string} statement The sentence to translate.
 * @property {Solution[]} solutions The accepted translations.
 */

/**
 * The translation challenges of the current practice session, arranged by statements.
 * @type {Object.<string, Challenge>}
 */
let currentChallenges = {};

/**
 * Prepares the translation challenges for a freshly started practice session.
 * @param {Array} newChallenges
 */
function handleNewChallenges(newChallenges) {
  currentChallenges = {};

  newChallenges.forEach(challenge => {
    if ((TRANSLATION_CHALLENGE_TYPES.indexOf(challenge.type) >= 0)
      && ('' !== String(challenge.prompt || '').trim())
      && lodash.isPlainObject(challenge.grader)
      && lodash.isArray(challenge.grader.vertices)
      && (challenge.grader.vertices.length > 0)
    ) {
      const locale = String(challenge.targetLanguage || challenge.grader.language || '').trim() || getUiLocale();
      const statement = String(challenge.prompt.normalize()).trim();
      const solutions = solution.fromVertices(challenge.grader.vertices, false, locale);

      if (solutions.length > 0) {
        currentChallenges[statement] = {
          statement,
          solutions: lodash.uniqWith(solutions, lodash.isEqual),
        };
      }
    }
  });
}

/**
 * A RegExp for the URL that is used by Duolingo to start a new practice session.
 * @type {RegExp}
 */
const NEW_SESSION_URL_REGEXP = /\/[\d]{4}-[\d]{2}-[\d]{2}\/sessions/g;

const originalRequestOpen = XMLHttpRequest.prototype.open;

XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
  if (url.match(NEW_SESSION_URL_REGEXP)) {
    this.addEventListener('load', () => {
      try {
        const data = lodash.isPlainObject(this.response)
          ? this.response
          : JSON.parse(this.responseText);

        if (lodash.isPlainObject(data)) {
          const baseChallenges = lodash.isArray(data.challenges) ? data.challenges : [];
          const adaptiveChallenges = lodash.isArray(data.adaptiveChallenges) ? data.adaptiveChallenges : [];
          handleNewChallenges(baseChallenges.concat(adaptiveChallenges));
        }
      } catch (error) {
        logError(error, 'Could not prepare the translation challenges for the new practice session: ');
      }
    });
  }

  return originalRequestOpen.call(this, method, url, async, user, password);
};

/**
 * A CSS selector for the statement of the current challenge, holding the sentence to translate.
 * @type {string}
 */
const CHALLENGE_STATEMENT_SELECTOR = '[data-test=hint-sentence]';

/**
 * A CSS selector for all the possible kinds of answer input.
 * @type {string}
 */
const ANSWER_INPUT_SELECTOR = [
  'input[data-test=challenge-text-input]',
  'textarea[data-test=challenge-translate-input]'
].join(', ');

/**
 * A CSS selector for the footer of the current challenge screen, holding the result and actions elements.
 * @type {string}
 */
const CHALLENGE_FOOTER_SELECTOR = '._1obm2';

/**
 * A CSS selector for the result wrapper of the current challenge screen.
 * @type {string}
 */
const RESULT_WRAPPER_SELECTOR = '._1Ag8k';

/**
 * The class name which is applied to the result wrapper when the user has given a correct answer.
 * @type {string}
 */
const RESULT_WRAPPER_CORRECT_CLASS_NAME = '_1WH_r';

/**
 * A CSS selector for the solution wrapper of the current challenge screen, holding the answer key to the challenge.
 * @type {string}
 */
const SOLUTION_WRAPPER_SELECTOR = '.vpbSG';

/**
 * A CSS selector for the list of actions links of the current challenge screen.
 * @type {string}
 */
const ACTION_LINK_LIST_SELECTOR = '._1Xpok';

/**
 * The UI elements whose purpose is to wrap some components from the extension.
 * @type {Object.<string, Element>}
 */
const componentWrappers = {};

/**
 * Returns a wrapper element for a component of the extension.
 * @param {Function} component
 * @param {Element} parentElement
 * @returns {Element}
 */
function getComponentWrapper(component, parentElement) {
  if (!componentWrappers[component.name] || !componentWrappers[component.name].isConnected) {
    const wrapper = document.createElement('div');
    wrapper.id = getUniqueElementId(EXTENSION_PREFIX + component.name + '-');
    componentWrappers[component.name] = wrapper;
  }

  parentElement.appendChild(componentWrappers[component.name]);

  return componentWrappers[component.name];
}

/**
 * Renders the closest possible solution to the user answer in the challenge screen.
 * @param {Solution} closestSolution
 * @param {Symbol} result
 */
function renderClosestSolution(closestSolution, result) {
  try {
    const solutionWrapper = document.querySelector(SOLUTION_WRAPPER_SELECTOR);

    if (solutionWrapper) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <ClosestSolution solution={solution.toDisplayableString(closestSolution, false)} result={result}/>
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
 * Renders the solution list modal in the challenge screen.
 * @param {Challenge} challenge
 * @param {string} userAnswer
 */
function renderSolutionListModal(challenge, userAnswer) {
  try {
    // Use a unique key to always reopen the modal.
    const modalKey = new Date().getTime().toString();

    render(
      <IntlProvider definition={getTranslations(getUiLocale())}>
        <SolutionListModal key={modalKey} {...challenge} userAnswer={userAnswer}/>
      </IntlProvider>,
      getComponentWrapper(SolutionListModal, document.body)
    );
  } catch (error) {
    logError(error, 'Could not render the solution list modal: ');
  }
}

/**
 * Renders the solution list link in the challenge screen.
 * @param {Challenge} challenge
 * @param {Symbol} result
 * @param {string} userAnswer
 */
function renderSolutionListLink(challenge, result, userAnswer) {
  try {
    const actionLinkList = document.querySelector(ACTION_LINK_LIST_SELECTOR);

    if (actionLinkList) {
      render(
        <IntlProvider definition={getTranslations(getUiLocale())}>
          <SolutionListLink result={result}
                            solutions={challenge.solutions}
                            onClick={() => renderSolutionListModal(challenge, userAnswer)}/>
        </IntlProvider>,
        getComponentWrapper(SolutionListLink, actionLinkList)
      );
    } else {
      throw new Error('Could not find the action link list element.');
    }
  } catch (error) {
    logError(error, 'Could not render the solution list link: ');
  }
}

/**
 * The last seen challenge footer element.
 * @type {Element|null}
 */
let challengeFooter = null;

/**
 * The last seen result wrapper element.
 * @type {Element|null}
 */
let resultWrapper = null;

/**
 * Handles the result of the current challenge.
 * @param {Element} resultWrapper
 */
function handleChallengeResult(resultWrapper) {
  const statementWrapper = document.querySelector(CHALLENGE_STATEMENT_SELECTOR);

  if (!statementWrapper) {
    return;
  }

  const statement = statementWrapper.innerText.normalize().trim();

  if (lodash.isPlainObject(currentChallenges[statement])) {
    const challenge = currentChallenges[statement];

    const result = resultWrapper.classList.contains(RESULT_WRAPPER_CORRECT_CLASS_NAME)
      ? RESULT_CORRECT
      : RESULT_INCORRECT;

    const answerInput = document.querySelector(ANSWER_INPUT_SELECTOR);
    const userAnswer = (answerInput && answerInput.value && String(answerInput.value).trim()) || '';

    if (!userAnswer) {
      challenge.solutions.forEach(lodash.set(_, 'score', 0));
    } else {
      challenge.solutions.forEach(item => lodash.set(item, 'score', solution.matchAgainstAnswer(item, userAnswer)));
    }

    if (
      userAnswer
      && (RESULT_INCORRECT === result)
      && (challenge.solutions.length > 1)
    ) {
      renderClosestSolution(lodash.maxBy(challenge.solutions, 'score'), result);
    }

    renderSolutionListLink(challenge, result, userAnswer);
  }
}

/**
 * A mutation observer for the footer of the challenge screen, detecting and handling challenge results.
 * @type {MutationObserver}
 */
const mutationObserver = new MutationObserver(() => {
  if (!challengeFooter) {
    return;
  }

  const newResultWrapper = challengeFooter.querySelector(RESULT_WRAPPER_SELECTOR);

  if (newResultWrapper !== resultWrapper) {
    resultWrapper = newResultWrapper;

    if (null !== resultWrapper) {
      try {
        handleChallengeResult(resultWrapper);
      } catch (error) {
        logError(error, 'Could not handle the challenge result: ');
      }
    }
  }
});

setInterval(() => {
  const newChallengeFooter = document.querySelector(CHALLENGE_FOOTER_SELECTOR);

  if (newChallengeFooter && (newChallengeFooter !== challengeFooter)) {
    challengeFooter = newChallengeFooter;
    mutationObserver.disconnect();
    mutationObserver.observe(challengeFooter, { childList: true, subtree: true });
  }
}, 50);
