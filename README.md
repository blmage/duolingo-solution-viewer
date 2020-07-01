<h1>
  <img align="center" width="48" height="48" src="https://raw.githubusercontent.com/blmage/duolingo-solution-viewer/master/dist/icons/icon_48.png" />
  Duolingo Solution Viewer
</h1>

[![DeepScan grade](https://deepscan.io/api/teams/9459/projects/11992/branches/180276/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=9459&pid=11992&bid=180276)
![ESLint](https://github.com/blmage/duolingo-solution-viewer/workflows/ESLint/badge.svg)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/idffaipgnlkhfhibgnodeiogpgojcmfm)](https://chrome.google.com/webstore/detail/duolingo-solution-viewer/idffaipgnlkhfhibgnodeiogpgojcmfm)
[![Mozilla Add-on](https://img.shields.io/amo/v/duolingo-solution-viewer)](https://addons.mozilla.org/firefox/addon/duolingo-solution-viewer/)

A browser extension providing access to the complete lists of **accepted solutions** for
[Duolingo](https://www.duolingo.com)'s **translation / listening challenges**, and restoring
the **correction of typos** for listening challenges.

### Table of contents

* [Download](#download)
* [Features](#features)
* [Keyboard shortcuts](#keyboard-shortcuts)
* [Limitations](#limitations)
* [Contributions](#contributions)
    * [Translations](#translations)
    * [Bug reports and feature requests](#bug-reports-and-feature-requests)

### Download

* [**Chrome** extension](https://chrome.google.com/webstore/detail/duolingo-solution-viewer/idffaipgnlkhfhibgnodeiogpgojcmfm)
* [**Firefox** add-on](https://addons.mozilla.org/firefox/addon/duolingo-solution-viewer/)

### Features

* Provides a link to the list of solutions of the current challenge, once you have submitted your answer:

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_solution_list_link.png" width="500" />

    * By default, the solutions are sorted by their similarity with your answer:

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_solution_list_modal.png" width="500" />

    * But you can also switch to an alphabetical sort:

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_solution_list_modal_alphabetical_sort.png" width="500" />

    * Click on your answer to edit it. The similarity scores of the solutions will be refreshed accordingly:

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_solution_list_modal_reference_update.png" width="500" />

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_solution_list_modal_update_result.png" width="500" />

* Remembers the lists of solutions of each challenge, to also make them available from the corresponding forum discussions:

    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_forum_solution_list.png" width="500" />

    * All the options seen above are also accessible in the forum, such as editing your reference:
    
    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_forum_solution_list_reference_update.png" width="500" />
    
    <img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_forum_solution_list_update_result.png" width="500" />

* Displays the closest solution when the answer you submitted is incorrect:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_incorrect_answer_closest_solution.png" width="500" />

* Outlines typos in answers to listening challenges:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/base_correct_answer_listening_correction.png" width="500" />

* Strives to blend seamlessly in [Duolingo](https://www.duolingo.com)'s UI, and to be compatible with custom themes such as [Darklingo++](https://userstyles.org/styles/169205/darklingo):

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/dark_correct_answer_solution_list_link.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/dark_correct_answer_solution_list_modal.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/dark_forum_solution_list.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/dark_incorrect_answer_closest_solution.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets_v3/screenshots/dark_correct_answer_listening_correction.png" width="500" />

### Keyboard shortcuts

After having submitted an answer to a challenge, use:
* `s` to open the solution window, 
* `↑` / `↓` to scroll up / down the window content,
* `Esc` to close the solution window.

When a list of solutions is available, use:
* `←` / `→` to navigate through the pages one by one,
* `Ctrl` + `←` / `→` to go directly to the first / last page.

### Limitations

* The extension is deeply tied to how the UI components are "named", meaning that significant changes on
  [Duolingo](https://www.duolingo.com)'s side could (temporarily) break it. If that happens, you can either:
    * wait for me to fix it,
    * try to fix it yourself, then open a related [PR](https://github.com/blmage/duolingo-solution-viewer/compare).

* The lists of solutions are built by flattening the original solution graphs, which are not optimized against
  redundancies (_they actually don't need to be_). This can lead to lists of solutions containing lots of very similar
  sentences.

* "Fill in the blank" challenges are based on "normal" translation challenges. The lists of solutions provided for them
  may  therefore include sentences that do not match the blanks.  

## Contributions

### Translations

The extension falls back to _English_ when translations for the current UI language are not available.

The currently supported languages are:

<table>
  <tr>
    <td><img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/flags/US.svg" width="30" /></td>
    <td>English</td>
  </tr>
  <tr>
    <td><img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/flags/FR.svg" width="30" /></td>
    <td>French</td>
  </tr>
</table>

If you wish to contribute a new language, or to improve on existing translations, please update the
[translations file](https://github.com/blmage/duolingo-solution-viewer/blob/master/src/translations.js), then open a
[PR](https://github.com/blmage/duolingo-solution-viewer/compare)!

### Bug reports and feature requests

If you encounter a bug, or if you have a suggestion regarding a new feature, don't hesitate to post a
[new issue](https://github.com/blmage/duolingo-solution-viewer/issues/new)!
\
\
\
_The country flags on this page were taken from this project: https://yammadev.github.io/flag-icons/ (MIT license)._
