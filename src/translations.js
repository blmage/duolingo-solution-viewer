/**
 * The full set of translations.
 * @type {Object}
 */
const TRANSLATIONS = {
  en: {
    solution: {
      closest: {
        closest_solution: "Closest solution:"
      },
      list: {
        link: {
          solutions: "Solutions ({{count}})"
        },
        modal: {
          correct_solutions: "Correct solutions:",
          exclude_automatic: "Exclude automatic ({{count}})",
          include_automatic: "Include automatic ({{count}})",
          sort_alphabetically: "Sort alphabetically",
          sort_by_similarity: "Sort by similarity",
          statement: "Statement:",
          your_answer: "Your answer:"
        }
      }
    }
  },
  fr: {
    solution: {
      closest: {
        closest_solution: "Solution la plus proche :"
      },
      list: {
        link: {
          solutions: "Solutions ({{count}})"
        },
        modal: {
          correct_solutions: "Solutions correctes :",
          exclude_automatic: "Exclure automatiques ({{count}})",
          include_automatic: "Inclure automatiques ({{count}})",
          sort_alphabetically: "Trier alphabétiquement",
          sort_by_similarity: "Trier par similarité",
          statement: "Énoncé :",
          your_answer: "Votre réponse :"
        }
      }
    }
  }
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
