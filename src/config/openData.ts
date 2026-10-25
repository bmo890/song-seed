/**
 * The open sources the word tools and Borrowed Words draw on, credited in
 * Help & info (2026-10-25). Several are CC BY-SA, which asks for exactly this:
 * name the source, link it, say what it's used for. A new source joins this
 * list in the same change that starts using it.
 */
export type OpenDataSource = {
  name: string;
  /** settingsAbout.openDataUse.<use> — what SongNook uses it for. */
  use: "rhymesDe" | "synonymsDe" | "wordRanks" | "wordsEnEs" | "rhymesHe" | "books" | "booksHe";
  url: string;
};

export const OPEN_DATA_SOURCES: OpenDataSource[] = [
  { name: "Datamuse", use: "wordsEnEs", url: "https://www.datamuse.com/api/" },
  { name: "Wiktionary", use: "rhymesDe", url: "https://de.wiktionary.org" },
  { name: "OpenThesaurus", use: "synonymsDe", url: "https://www.openthesaurus.de" },
  { name: "FrequencyWords", use: "wordRanks", url: "https://github.com/hermitdave/FrequencyWords" },
  { name: "Dicta", use: "rhymesHe", url: "https://dicta.org.il" },
  { name: "Project Gutenberg", use: "books", url: "https://www.gutenberg.org" },
  { name: "Project Ben-Yehuda", use: "booksHe", url: "https://benyehuda.org" },
];
