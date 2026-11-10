import type { MagpieBook } from "../types";

/** The curated pool Magpie draws from by default — public-domain works from
 * Project Gutenberg, chosen for rich, varied prose and poetry across eras rather
 * than the reference material (dictionaries, indexes, legal codes) that a truly
 * random draw from the whole library would often surface. This is deliberately a
 * plain list of ids + display names; the page text is Range-fetched at runtime
 * from Gutenberg, never bundled. Prune or extend freely.
 *
 * `id` is the Project Gutenberg ebook id. `textUrl` points at the pre-generated
 * UTF-8 cache file, which serves HTTP Range requests directly (no redirect).
 *
 * Every entry must be public domain in Europe and Brazil too, not only the US:
 * author AND translator dead 70+ years (2026-10-25 audit dropped Du Bois, the
 * Della Chiesa Pinocchio and the Wyllie Kafka translations). */
export type CuratedBook = { id: number; title: string; author: string };

function gutenbergCacheTextUrl(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
}

/** Gutenberg's auto-generated cover thumbnail — derivable from the id alone, so
 * it works for curated books and whole-library draws without an extra call. */
export function gutenbergCoverUrl(id: number | string): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

/** Canonical Gutenberg page for the work, for the source credit / click-through. */
export function gutenbergSourceUrl(id: number | string): string {
  return `https://www.gutenberg.org/ebooks/${id}`;
}

/** Turn a curated entry into the runtime book shape carried on a spark. */
export function toMagpieBook(entry: CuratedBook): MagpieBook {
  return {
    id: String(entry.id),
    title: entry.title,
    author: entry.author,
    textUrl: gutenbergCacheTextUrl(entry.id),
    source: "gutenberg",
    thumbnailUrl: gutenbergCoverUrl(entry.id),
    sourceUrl: gutenbergSourceUrl(entry.id),
  };
}

/** All ids verified present on Gutendex with a text/plain format. */
const ENGLISH_SHELF: CuratedBook[] = [
  { id: 1342, title: "Pride and Prejudice", author: "Jane Austen" },
  { id: 158, title: "Emma", author: "Jane Austen" },
  { id: 161, title: "Sense and Sensibility", author: "Jane Austen" },
  { id: 105, title: "Persuasion", author: "Jane Austen" },
  { id: 141, title: "Mansfield Park", author: "Jane Austen" },
  { id: 2701, title: "Moby-Dick", author: "Herman Melville" },
  { id: 84, title: "Frankenstein", author: "Mary Shelley" },
  { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle" },
  { id: 2852, title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
  { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
  { id: 76, title: "Adventures of Huckleberry Finn", author: "Mark Twain" },
  { id: 74, title: "The Adventures of Tom Sawyer", author: "Mark Twain" },
  { id: 98, title: "A Tale of Two Cities", author: "Charles Dickens" },
  { id: 1400, title: "Great Expectations", author: "Charles Dickens" },
  { id: 730, title: "Oliver Twist", author: "Charles Dickens" },
  { id: 46, title: "A Christmas Carol", author: "Charles Dickens" },
  { id: 174, title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
  { id: 844, title: "The Importance of Being Earnest", author: "Oscar Wilde" },
  { id: 345, title: "Dracula", author: "Bram Stoker" },
  { id: 2542, title: "A Doll's House", author: "Henrik Ibsen" },
  { id: 1260, title: "Jane Eyre", author: "Charlotte Brontë" },
  { id: 768, title: "Wuthering Heights", author: "Emily Brontë" },
  { id: 1232, title: "The Prince", author: "Niccolò Machiavelli" },
  { id: 2600, title: "War and Peace", author: "Leo Tolstoy" },
  { id: 1399, title: "Anna Karenina", author: "Leo Tolstoy" },
  { id: 2554, title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
  { id: 28054, title: "The Brothers Karamazov", author: "Fyodor Dostoevsky" },
  { id: 600, title: "Notes from the Underground", author: "Fyodor Dostoevsky" },
  { id: 996, title: "Don Quixote", author: "Miguel de Cervantes" },
  { id: 1727, title: "The Odyssey", author: "Homer" },
  { id: 6130, title: "The Iliad", author: "Homer" },
  { id: 1998, title: "Thus Spake Zarathustra", author: "Friedrich Nietzsche" },
  { id: 4300, title: "Ulysses", author: "James Joyce" },
  { id: 2814, title: "Dubliners", author: "James Joyce" },
  { id: 4217, title: "A Portrait of the Artist as a Young Man", author: "James Joyce" },
  { id: 205, title: "Walden", author: "Henry David Thoreau" },
  { id: 1322, title: "Leaves of Grass", author: "Walt Whitman" },
  { id: 1934, title: "Songs of Innocence and of Experience", author: "William Blake" },
  { id: 2591, title: "Grimms' Fairy Tales", author: "The Brothers Grimm" },
  { id: 1597, title: "Andersen's Fairy Tales", author: "Hans Christian Andersen" },
  { id: 16, title: "Peter Pan", author: "J. M. Barrie" },
  { id: 55, title: "The Wonderful Wizard of Oz", author: "L. Frank Baum" },
  { id: 215, title: "The Call of the Wild", author: "Jack London" },
  { id: 910, title: "White Fang", author: "Jack London" },
  { id: 35, title: "The Time Machine", author: "H. G. Wells" },
  { id: 36, title: "The War of the Worlds", author: "H. G. Wells" },
  { id: 5230, title: "The Invisible Man", author: "H. G. Wells" },
  { id: 164, title: "Twenty Thousand Leagues Under the Sea", author: "Jules Verne" },
  { id: 103, title: "Around the World in Eighty Days", author: "Jules Verne" },
  { id: 120, title: "Treasure Island", author: "Robert Louis Stevenson" },
  { id: 43, title: "The Strange Case of Dr. Jekyll and Mr. Hyde", author: "Robert Louis Stevenson" },
  { id: 421, title: "Kidnapped", author: "Robert Louis Stevenson" },
  { id: 219, title: "Heart of Darkness", author: "Joseph Conrad" },
  { id: 5658, title: "Lord Jim", author: "Joseph Conrad" },
  { id: 33, title: "The Scarlet Letter", author: "Nathaniel Hawthorne" },
  { id: 514, title: "Little Women", author: "Louisa May Alcott" },
  { id: 45, title: "Anne of Green Gables", author: "L. M. Montgomery" },
  { id: 113, title: "The Secret Garden", author: "Frances Hodgson Burnett" },
  { id: 145, title: "Middlemarch", author: "George Eliot" },
  { id: 6688, title: "The Mill on the Floss", author: "George Eliot" },
  { id: 829, title: "Gulliver's Travels", author: "Jonathan Swift" },
  { id: 521, title: "Robinson Crusoe", author: "Daniel Defoe" },
  { id: 1184, title: "The Count of Monte Cristo", author: "Alexandre Dumas" },
  { id: 1257, title: "The Three Musketeers", author: "Alexandre Dumas" },
  { id: 135, title: "Les Misérables", author: "Victor Hugo" },
  { id: 2413, title: "Madame Bovary", author: "Gustave Flaubert" },
  { id: 1524, title: "Hamlet", author: "William Shakespeare" },
  { id: 1513, title: "Romeo and Juliet", author: "William Shakespeare" },
  { id: 26, title: "Paradise Lost", author: "John Milton" },
  { id: 8800, title: "The Divine Comedy", author: "Dante Alighieri" },
  { id: 2383, title: "The Canterbury Tales", author: "Geoffrey Chaucer" },
  { id: 2680, title: "Meditations", author: "Marcus Aurelius" },
  { id: 1497, title: "The Republic", author: "Plato" },
  { id: 308, title: "Three Men in a Boat", author: "Jerome K. Jerome" },
  { id: 203, title: "Uncle Tom's Cabin", author: "Harriet Beecher Stowe" },
  { id: 160, title: "The Awakening", author: "Kate Chopin" },
  { id: 4517, title: "Ethan Frome", author: "Edith Wharton" },
  { id: 541, title: "The Age of Innocence", author: "Edith Wharton" },
  { id: 284, title: "The House of Mirth", author: "Edith Wharton" },
  { id: 242, title: "My Ántonia", author: "Willa Cather" },
  { id: 24, title: "O Pioneers!", author: "Willa Cather" },
  { id: 217, title: "Sons and Lovers", author: "D. H. Lawrence" },
  { id: 1952, title: "The Yellow Wallpaper", author: "Charlotte Perkins Gilman" },
  { id: 64317, title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
];

/** Works written in the language (no translations, so no translator's rights),
 *  authors dead before 1955. Each id checked 2026-11-09: the cache .txt answers a
 *  Range request with 206 and its header says the right language. These replace
 *  the whole-library draw, whose catalogue (gutendex.com) timed out for minutes. */
const SPANISH_SHELF: CuratedBook[] = [
  { id: 2000, title: "Don Quijote", author: "Miguel de Cervantes" },
  { id: 49836, title: "Niebla", author: "Miguel de Unamuno" },
  { id: 55514, title: "Cuentos de amor", author: "Emilia Pardo Bazán" },
  { id: 18005, title: "Los pazos de Ulloa", author: "Emilia Pardo Bazán" },
  { id: 25640, title: "Los argonautas", author: "Vicente Blasco Ibáñez" },
  { id: 24536, title: "Los cuatro jinetes del apocalipsis", author: "Vicente Blasco Ibáñez" },
  { id: 17013, title: "Fortunata y Jacinta", author: "Benito Pérez Galdós" },
  { id: 17340, title: "Marianela", author: "Benito Pérez Galdós" },
  { id: 52392, title: "Miau", author: "Benito Pérez Galdós" },
  { id: 17073, title: "La Regenta", author: "Leopoldo Alas, Clarín" },
  { id: 17223, title: "Pepita Jiménez", author: "Juan Valera" },
  { id: 29506, title: "El sombrero de tres picos", author: "Pedro Antonio de Alarcón" },
  { id: 23600, title: "La gaviota", author: "Fernán Caballero" },
  { id: 25777, title: "El idilio de un enfermo", author: "Armando Palacio Valdés" },
  { id: 21282, title: "Tradiciones peruanas", author: "Ricardo Palma" },
  { id: 47584, title: "Noli me tángere", author: "José Rizal" },
];

const GERMAN_SHELF: CuratedBook[] = [
  { id: 22367, title: "Die Verwandlung", author: "Franz Kafka" },
  { id: 21593, title: "Das Urteil", author: "Franz Kafka" },
  { id: 69327, title: "Der Prozess", author: "Franz Kafka" },
  { id: 2407, title: "Die Leiden des jungen Werther", author: "Johann Wolfgang von Goethe" },
  { id: 35312, title: "Aus dem Leben eines Taugenichts", author: "Joseph von Eichendorff" },
  { id: 5323, title: "Effi Briest", author: "Theodor Fontane" },
  { id: 29376, title: "Bahnwärter Thiel", author: "Gerhart Hauptmann" },
  { id: 34717, title: "Die Verwirrungen des Zöglings Törleß", author: "Robert Musil" },
  { id: 38686, title: "Die Liebe der Erika Ewald", author: "Stefan Zweig" },
  { id: 38126, title: "Der Untertan", author: "Heinrich Mann" },
  { id: 25721, title: "Caspar Hauser", author: "Jakob Wassermann" },
  { id: 7205, title: "Also sprach Zarathustra", author: "Friedrich Nietzsche" },
  { id: 47406, title: "Aphorismen zur Lebensweisheit", author: "Arthur Schopenhauer" },
  { id: 24782, title: "Der Dunkelgraf", author: "Ludwig Bechstein" },
  { id: 50277, title: "Kleinstadtkinder", author: "Josephine Siebe" },
];

const PORTUGUESE_SHELF: CuratedBook[] = [
  { id: 55752, title: "Dom Casmurro", author: "Machado de Assis" },
  { id: 54829, title: "Memórias Póstumas de Brás Cubas", author: "Machado de Assis" },
  { id: 55682, title: "Quincas Borba", author: "Machado de Assis" },
  { id: 55797, title: "Memorial de Aires", author: "Machado de Assis" },
  { id: 33056, title: "Histórias sem Data", author: "Machado de Assis" },
  { id: 40409, title: "Os Maias", author: "Eça de Queirós" },
  { id: 18220, title: "A Cidade e as Serras", author: "Eça de Queirós" },
  { id: 16384, title: "O Mandarim", author: "Eça de Queirós" },
  { id: 17515, title: "A Relíquia", author: "Eça de Queirós" },
  { id: 31347, title: "Contos", author: "Eça de Queirós" },
  { id: 16425, title: "Amor de Perdição", author: "Camilo Castelo Branco" },
  { id: 67740, title: "Iracema", author: "José de Alencar" },
  { id: 69187, title: "O Cortiço", author: "Aluísio Azevedo" },
  { id: 24401, title: "Viagens na Minha Terra", author: "Almeida Garrett" },
  { id: 67535, title: "Triste Fim de Policarpo Quaresma", author: "Lima Barreto" },
];

/** Every Gutenberg language's hand-picked shelf (Hebrew draws from Ben-Yehuda). */
export const CURATED_SHELVES: Record<"en" | "es" | "de" | "pt", CuratedBook[]> = {
  en: ENGLISH_SHELF,
  es: SPANISH_SHELF,
  de: GERMAN_SHELF,
  pt: PORTUGUESE_SHELF,
};

/** A random book from a language's shelf, as the runtime shape. */
export function randomCuratedBook(language: "en" | "es" | "de" | "pt" = "en"): MagpieBook {
  const shelf = CURATED_SHELVES[language];
  return toMagpieBook(shelf[Math.floor(Math.random() * shelf.length)]!);
}
