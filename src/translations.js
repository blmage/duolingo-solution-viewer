/**
 * The full set of translations.
 *
 * @type {object}
 */
const TRANSLATIONS = {
  en: {
    solution: {
      result: {
        closest_solution: 'Closest solution:',
      },
      list: {
        link: {
          solutions: 'Solutions ({{count}})',
        },
        modal: {
          fit_to_content: 'Fit to content',
          maximize: 'Maximize',
          minimize: 'Minimize',
          statement: 'Statement:',
          your_answer: 'Your answer:',
        },
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
    },
  },
  fr: {
    solution: {
      result: {
        closest_solution: 'Solution la plus proche :',
      },
      list: {
        link: {
          solutions: 'Solutions ({{count}})',
        },
        modal: {
          fit_to_content: 'Adapter au contenu',
          maximize: 'Maximiser',
          minimize: 'Minimiser',
          statement: 'Énoncé :',
          your_answer: 'Votre réponse :',
        },
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
