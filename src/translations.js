/**
 * The full set of translations.
 * @type {Object}
 */
const TRANSLATIONS = {
  en: {
    solution: {
      closest: {
        closest_solution: "Closest solution:",
      },
      list: {
        link: {
          solutions: "Solutions ({{count}})",
        },
        modal: {
          statement: "Statement:",
          your_answer: "Your answer:",
        },
        alphabetical_sort: "Alphabetical sort",
        correct_solutions: "Correct solutions:",
        similarity_sort: "Similarity sort",
        sort_ascending: "Sort in ascending order",
        sort_alphabetically: "Sort alphabetically",
        sort_by_similarity: "Sort by similarity",
        sort_descending: "Sort in descending order",
      },
    },
  },
  fr: {
    solution: {
      closest: {
        closest_solution: "Solution la plus proche :",
      },
      list: {
        link: {
          solutions: "Solutions ({{count}})",
        },
        modal: {
          statement: "Énoncé :",
          your_answer: "Votre réponse :",
        },
        alphabetical_sort: "Tri alphabétique",
        correct_solutions: "Solutions correctes :",
        similarity_sort: "Tri par similarité",
        sort_ascending: "Trier par ordre croissant",
        sort_alphabetically: "Trier alphabétiquement",
        sort_by_similarity: "Trier par similarité",
        sort_descending: "Trier par ordre décroissant",
      },
    },
  },
};

/**
 * Returns the available translations for a given language tag.
 * @param {string} languageTag
 * @returns {Object}
 */
export function getTranslations(languageTag) {
  return (
    TRANSLATIONS[languageTag] || TRANSLATIONS[languageTag.substring(0, 2)] || {}
  );
}
