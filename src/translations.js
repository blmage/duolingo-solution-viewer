/**
 * The full set of translations.
 *
 * @type {object}
 */
const TRANSLATIONS = {
  en: {
    challenge: {
      statement: 'Statement:',
    },
    closest_solution: {
      title: 'Closest solution:',
    },
    corrected_answer: {
      title: 'Corrected answer:',
    },
    modal: {
      fit_to_content: 'Fit to content',
      maximize: 'Maximize',
      minimize: 'Minimize',
    },
    pagination: {
      go_to_first: 'Go to first page',
      go_to_last: 'Go to last page',
      go_to_page: 'Go to page {{page}}',
      go_to_next: 'Go to next page',
      go_to_previous: 'Go to previous page',
    },
    solution_link: {
      label: 'Solutions ({{count}})',
    },
    solution_list: {
      all: 'all',
      alphabetical_sort: 'Alphabetical sort',
      correct_solutions: 'Correct solutions:',
      per_page: 'per page:',
      similarity_sort: 'Similarity sort',
      sort_ascending: 'Sort in ascending order',
      sort_alphabetically: 'Sort alphabetically',
      sort_by_similarity: 'Sort by similarity',
      sort_descending: 'Sort in descending order',
    },
    user_reference: {
      cancel: 'Cancel',
      none: 'None yet',
      title: 'Your reference:',
      update: 'Update',
    },
  },
  fr: {
    challenge: {
      statement: 'Énoncé :',
    },
    closest_solution: {
      title: 'Solution la plus proche :',
    },
    corrected_answer: {
      title: 'Réponse corrigée :',
    },
    modal: {
      fit_to_content: 'Adapter au contenu',
      maximize: 'Maximiser',
      minimize: 'Minimiser',
    },
    pagination: {
      go_to_first: 'Aller à la première page',
      go_to_last: 'Aller à la dernière page',
      go_to_page: 'Aller à la page {{page}}',
      go_to_next: 'Aller à la page suivante',
      go_to_previous: 'Aller à la page précédente',
    },
    solution_link: {
      label: 'Solutions ({{count}})',
    },
    solution_list: {
      all: 'tout',
      alphabetical_sort: 'Tri alphabétique',
      correct_solutions: 'Solutions correctes :',
      per_page: 'par page :',
      similarity_sort: 'Tri par similarité',
      sort_ascending: 'Trier par ordre croissant',
      sort_alphabetically: 'Trier alphabétiquement',
      sort_by_similarity: 'Trier par similarité',
      sort_descending: 'Trier par ordre décroissant',
    },
    user_reference: {
      cancel: 'Annuler',
      none: 'Aucune pour l\'instant',
      update: 'Modifier',
      your_reference: 'Ta référence :',
    },
  },
};

/**
 * @param {string} languageTag A language tag.
 * @returns {object} The available translations for the given language tag.
 */
export function getTranslations(languageTag) {
  return (
    TRANSLATIONS[languageTag] || TRANSLATIONS[languageTag.substring(0, 2)] || {}
  );
}
