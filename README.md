# Duolingo Solution Viewer

A browser extension providing access to the complete lists of **accepted solutions** for
[Duolingo](https://www.duolingo.com)'s **translation challenges**.

### Table of contents

* [Download](#download)
* [Features](#features)
* [Limitations](#limitations)
* [Tested courses](#tested-courses)
* [Contributions](#contributions)
    * [Translations](#translations)
    * [Bug reports and feature requests](#bug-reports-and-feature-requests)

### Download

* [**Chrome** extension](https://chrome.google.com/webstore/detail/duolingo-solution-viewer/idffaipgnlkhfhibgnodeiogpgojcmfm)
* [**Firefox** add-on](https://addons.mozilla.org/fr/firefox/addon/duolingo-solution-viewer/)

### Features

After an answer has been submitted, provides a link to the corresponding list of solutions:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_correct_answer_solution_list_link.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_incorrect_answer_solution_list_link.png" width="500" />

This link opens a window with a summary of the challenge, including all the accepted solutions:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_correct_answer_solution_list_modal.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_incorrect_answer_solution_list_modal.png" width="500" />

Those solutions can be sorted on their similarity with the given answer, rather than alphabetically:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_correct_answer_solution_list_modal_similarity.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_incorrect_answer_solution_list_modal_similarity.png" width="500" />

When an incorrect response is submitted, the closest correct solution is displayed:

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/base_incorrect_answer_closest_solution.png" width="500" />

The extension strives to blend seamlessly in [Duolingo](https://www.duolingo.com)'s UI, and to be compatible with
custom themes such as [Darklingo++](https://userstyles.org/styles/169205/darklingo):

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/dark_correct_answer_solution_list_link_dark.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/dark_correct_answer_solution_list_modal_dark.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/dark_incorrect_answer_solution_list_link_errror_dark.png" width="500" />

<img src="https://github.com/blmage/duolingo-solution-viewer/blob/assets/screenshots/dark_incorrect_answer_solution_list_modal_error_dark.png" width="500" />

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

* Due to the intrinsic limitations of browser extensions, if a lesson or practice page is accessed directly
  (either by entering its URL or by refreshing the page), the corresponding lists of solutions won't be available.

### Tested courses

The extension should already be **compatible with most courses**, but has only been tested so far with:

<table>
  <tr>
    <th>Speaking</th>
    <th>Learning</th>
  </tr>
  <tr>
    <td rowspan="3">English</td>
    <td>French</td>
  </tr>
  <tr>
    <td>Klingon</td>
  </tr>
  <tr>
    <td>Vietnamese</td>
  </tr>
  <tr>
    <td rowspan="1">French</td>
    <td>English</td>
  </tr>
</table>

If you have tested the extension with a course that is not listed above, and:
* _it works well_: please let me know in the
  [dedicated issue](https://github.com/blmage/duolingo-solution-viewer/issues/1)!
* _you encountered some problems_: please report those in
  [a new issue](https://github.com/blmage/duolingo-solution-viewer/issues/new) (including as much details as possible).

## Contributions

### Translations

The extension falls back to _English_ when translations for the current UI language are not available.

The currently supported languages are:

<table>
  <tr>
    <td>:us:</td>
    <td>English</td>
  </tr>
  <tr>
    <td>:fr:</td>
    <td>French</td>
  </tr>
</table>

If you wish to contribute a new language, or to improve on existing translations, please update the
[translations file](https://github.com/blmage/duolingo-solution-viewer/blob/master/src/translations.js), then open a
[PR](https://github.com/blmage/duolingo-solution-viewer/compare)!

### Bug reports and feature requests

If you encounter a bug, or if you have a suggestion regarding a new feature, don't hesitate to post a
[new issue](https://github.com/blmage/duolingo-solution-viewer/issues/new)!
