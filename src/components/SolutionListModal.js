import { Fragment, h } from 'preact';
import { IntlProvider, Text } from 'preact-i18n';
import { StyleSheet, css } from 'aphrodite';
import lodash from 'lodash';
import { it } from 'param.macro';
import { BASE, BaseComponent } from './BaseComponent';
import { CLOSE_ICON_CDN_PATH } from '../constants';
import * as solution from '../functions';
import { discardEvent, getImageCdnBaseUrl } from '../functions';

const OVERLAY = 'overlay';
const WRAPPER = 'wrapper';
const CLOSE_BUTTON = 'close_button';
const CONTENT = 'content';
const LINK = 'link';

const STATE_PENDING = Symbol('pending');
const STATE_OPENING = Symbol('opening');
const STATE_OPENED = Symbol('opened');
const STATE_CLOSING = Symbol('closing');
const STATE_CLOSED = Symbol('closed');

const CLASS_NAMES = {
  [OVERLAY]: {
    [BASE]: ['_16E8f', '_18rH6', '_3wo9p'],
    [STATE_PENDING]: ['_2WcLD'],
    [STATE_OPENING]: ['_39TEz'],
    [STATE_OPENED]: ['_39TEz'],
    [STATE_CLOSING]: ['_2WcLD'],
  },
  [WRAPPER]: {
    [BASE]: ['_3Xf7y', 'w4pY4', '_1qa4z', '_3wo9p'],
    [STATE_PENDING]: ['_2WcLD'],
    [STATE_OPENING]: ['_2WcLD'],
    [STATE_OPENED]: ['_39TEz'],
  },
  [CLOSE_BUTTON]: {
    [BASE]: ['_2YJA9'],
  },
  [CONTENT]: {
    [BASE]: ['_2vnDy'],
  },
  [LINK]: {
    [BASE]: ['_2rA41'],
  },
};

const STYLES = StyleSheet.create({
  [WRAPPER]: {
    maxHeight: '90%',
    maxWidth: '90%',
  },
  [CONTENT]: {
    maxHeight: 'calc(90vh - 60px)',
    overflowY: 'auto',
    paddingRight: '0.5em',
  },
  titleWithActionList: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  titleText: {
    marginRight: '1em',
  },
  [LINK]: {
    fontSize: '0.7em',
    marginRight: '0.5em',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  actionSeparator: {
    fontSize: '0.7em',
    fontWeight: '400',
    marginRight: '0.5em',
  },
  solution: {
    padding: '0.4em 0.5em 0.3em',
    ':nth-child(even)': {
      background: 'rgba(0, 0, 0, 0.125)',
    },
  },
  automaticSolution: {
    fontStyle: 'italic',
  },
});

/**
 * A component for displaying a list of solutions in a modal.
 */
export default class SolutionListModal extends BaseComponent {
  constructor(props) {
    super(props);

    this.state = this.loadPersistentState();
    this.state.modalState = STATE_PENDING;
    this.openedTimeout = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.close = this.close.bind(this);
    this.toggleAutomaticDisplay = this.toggleAutomaticDisplay.bind(this);
    this.toggleSimilaritySort = this.toggleSimilaritySort.bind(this);
    this.renderSolutionItem = this.renderSolutionItem.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);

    // Simulates the original opening effect (first the overlay, then the content).
    setTimeout(() => this.setState({ modalState: STATE_OPENING }), 1);
    this.openedTimeout = setTimeout(() => this.setState({ modalState: STATE_OPENED }), 300);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  getDefaultPersistentState() {
    return {
      showAutomatic: false,
      sortBySimilarity: false
    };
  }

  getComponentStateKey() {
    return this.state.modalState;
  }

  getAllElementClassNames() {
    return CLASS_NAMES;
  }

  getAllElementStyles() {
    return STYLES;
  }

  /**
   * A callback for "keydown" events.
   * @param {Event} event
   */
  handleKeyDown(event) {
    if ((STATE_OPENED === this.state.modalState) && ('Escape' === event.key)) {
      this.close();
      discardEvent(event);
    }
  }

  /**
   * Closes the modal.
   */
  close() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.setState({ modalState: STATE_CLOSING });
    this.openedTimeout && clearTimeout(this.openedTimeout);
    setTimeout(() => this.setState({ modalState: STATE_CLOSED }), 300);
  }

  /**
   * Toggles the display of automatic solutions and tokens.
   */
  toggleAutomaticDisplay() {
    this.saveState({ showAutomatic: !this.state.showAutomatic });
  }

  /**
   * Toggles between the alphabetical sort and the sort on similarity.
   */
  toggleSimilaritySort() {
    this.saveState({ sortBySimilarity: !this.state.sortBySimilarity });
  }

  /**
   * Renders a list item for a single solution.
   * @param {Solution} value
   * @returns {Component}
   */
  renderSolutionItem(value) {
    return (
      <li className={css([STYLES.solution, value.isAutomatic && STYLES.automaticSolution])}>
        {solution.toDisplayableString(value, this.state.showAutomatic)}
      </li>
    );
  }

  render({ statement = '', userAnswer = '', solutions = [] }, state) {
    if ((STATE_CLOSED === state.modalState) || (0 === solutions.length)) {
      return null;
    }

    const linkClassName = this.getElementClassNames(LINK);

    const [
      baseSolutions,
      automaticSolutions
    ] = lodash.partition(solutions, !it.isAutomatic);

    const solutionItems = baseSolutions
      .concat(this.state.showAutomatic ? automaticSolutions : [])
      .sort(this.state.sortBySimilarity ? solution.compareScores : solution.compareValues)
      .map(this.renderSolutionItem);

    const hasAutomatic = automaticSolutions.length > 0;
    const automaticCounts = solution.getI18nCounts(automaticSolutions);

    return (
      <IntlProvider scope="solution.list.modal">
        <div className={this.getElementClassNames(OVERLAY)} onClick={this.close}>
          <div className={this.getElementClassNames(WRAPPER)} role="dialog" tabIndex="-1" onClick={discardEvent}>
            <div className={this.getElementClassNames(CLOSE_BUTTON)} onClick={this.close}>
              <img src={getImageCdnBaseUrl() + CLOSE_ICON_CDN_PATH}/>
            </div>
            <div className={this.getElementClassNames(CONTENT)}>
              {statement && (
                <Fragment>
                  <h3>
                    <Text id="statement">Statement:</Text>
                  </h3>
                  <p>{statement}</p>
                </Fragment>
              )}
              {userAnswer && (
                <Fragment>
                  <h3>
                    <Text id="your_answer">Your answer:</Text>
                  </h3>
                  <p>{userAnswer}</p>
                </Fragment>
              )}
              <h3 className={css(STYLES.titleWithActionList)}>
                <span className={css(STYLES.titleText)}>
                  <Text id="correct_solutions">Correct solutions:</Text>
                </span>
                <div>
                  {hasAutomatic && (
                    <Fragment>
                      <a className={linkClassName} onClick={this.toggleAutomaticDisplay}>
                        <Text id={state.showAutomatic ? 'exclude_automatic' : 'include_automatic'}
                              plural={automaticCounts.plural}
                              fields={{ count: automaticCounts.display }}>
                          {state.showAutomatic
                            ? `Exclude automatic (${automaticCounts.display})`
                            : `Include automatic (${automaticCounts.display})`}
                        </Text>
                      </a>
                      <span className={css(STYLES.actionSeparator)}>/</span>
                    </Fragment>
                  )}
                  {userAnswer && (
                    <a className={linkClassName} onClick={this.toggleSimilaritySort}>
                      {state.sortBySimilarity
                        ? <Text id="sort_alphabetically">Sort alphabetically</Text>
                        : <Text id="sort_by_similarity">Sort by similarity</Text>}
                    </a>
                  )}
                </div>
              </h3>
              <ul>{solutionItems}</ul>
            </div>
          </div>
        </div>
      </IntlProvider>
    );
  }
}
