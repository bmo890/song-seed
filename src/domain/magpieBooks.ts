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
 *  the whole-library draw, whose catalogue (gutendex.com) timed out for minutes.
 *  Widened 2026-11-18 (founder: more books, fewer repeats): prose only, no plays,
 *  poetry or translations, each checked on the gutenberg.pglaf.org mirror too. */
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
  { id: 13507, title: "Cuentos de amor de locura y de muerte", author: "Horacio Quiroga" },
  { id: 52597, title: "Insolación y Morriña", author: "Emilia Pardo Bazán" },
  { id: 55882, title: "La dama joven", author: "Emilia Pardo Bazán" },
  { id: 21831, title: "Misericordia", author: "Benito Pérez Galdós" },
  { id: 16961, title: "Trafalgar", author: "Benito Pérez Galdós" },
  { id: 25956, title: "La desheredada", author: "Benito Pérez Galdós" },
  { id: 26655, title: "Tristán o el pesimismo", author: "Armando Palacio Valdés" },
  { id: 23035, title: "Quilito", author: "Carlos María Ocantos" },
  { id: 28281, title: "Cecilia Valdés", author: "Cirilo Villaverde" },
  { id: 33267, title: "Facundo", author: "Domingo Faustino Sarmiento" },
  { id: 32315, title: "El Buscón", author: "Francisco de Quevedo" },
  { id: 49660, title: "La Alhambra: leyendas árabes", author: "Manuel Fernández y González" },
  { id: 26771, title: "Thespis", author: "Carlos Octavio Bunge" },
  { id: 78052, title: "Andanzas y visiones españolas", author: "Miguel de Unamuno" },
  { id: 59852, title: "Del sentimiento trágico de la vida", author: "Miguel de Unamuno" },
  { id: 28592, title: "El pecado y la noche", author: "Antonio de Hoyos y Vinent" },
  { id: 52894, title: "Azul…", author: "Rubén Darío" },
  { id: 19898, title: "La Edad de Oro", author: "José Martí" },
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
  { id: 21989, title: "Ein Landarzt", author: "Franz Kafka" },
  { id: 25791, title: "In der Strafkolonie", author: "Franz Kafka" },
  { id: 23532, title: "Betrachtung", author: "Franz Kafka" },
  { id: 76360, title: "Die Elixiere des Teufels", author: "E. T. A. Hoffmann" },
  { id: 50285, title: "Dr. Mabuse, der Spieler", author: "Norbert Jacques" },
  { id: 77073, title: "Die Flucht der Beate Hoyermann", author: "Thea von Harbou" },
  { id: 78125, title: "Liebe ist ewig", author: "Wilhelm von Polenz" },
  { id: 66452, title: "Die Liebe", author: "Hans Kaltneker" },
  { id: 20944, title: "Nach Amerika!", author: "Friedrich Gerstäcker" },
  { id: 50528, title: "Pitt und Fox", author: "Friedrich Huch" },
  { id: 67217, title: "Gretchen Reinwalds letztes Schuljahr", author: "Agnes Sapper" },
  { id: 51582, title: "Die Sternbuben in der Großstadt", author: "Josephine Siebe" },
  { id: 7204, title: "Jenseits von Gut und Böse", author: "Friedrich Nietzsche" },
  { id: 40739, title: "Die Traumdeutung", author: "Sigmund Freud" },
  { id: 34222, title: "Das Unheimliche", author: "Sigmund Freud" },
  { id: 21801, title: "Briefe an eine Freundin", author: "Wilhelm von Humboldt" },
  { id: 78056, title: "Urwald", author: "Raoul Heinrich Francé" },
  { id: 78026, title: "Skizzen einer Fußreise durch Oesterreich", author: "Josef Kyselak" },
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
  { id: 23145, title: "A Ilustre Casa de Ramires", author: "Eça de Queirós" },
  { id: 31971, title: "O Crime do Padre Amaro", author: "Eça de Queirós" },
  { id: 42942, title: "O Primo Basílio", author: "Eça de Queirós" },
  { id: 27637, title: "A Correspondência de Fradique Mendes", author: "Eça de Queirós" },
  { id: 20574, title: "O Mistério da Estrada de Sintra", author: "Eça de Queirós" },
  { id: 21406, title: "Novelas do Minho", author: "Camilo Castelo Branco" },
  { id: 17927, title: "A Queda dum Anjo", author: "Camilo Castelo Branco" },
  { id: 57001, title: "Papéis Avulsos", author: "Machado de Assis" },
  { id: 53101, title: "A Mão e a Luva", author: "Machado de Assis" },
  { id: 67162, title: "Helena", author: "Machado de Assis" },
  { id: 56737, title: "Esaú e Jacó", author: "Machado de Assis" },
  { id: 67780, title: "Iaiá Garcia", author: "Machado de Assis" },
  { id: 67724, title: "O Guarani", author: "José de Alencar" },
  { id: 44540, title: "Cinco Minutos", author: "José de Alencar" },
  { id: 68541, title: "O Ateneu", author: "Raul Pompeia" },
  { id: 74475, title: "A Escrava Isaura", author: "Bernardo Guimarães" },
  { id: 16428, title: "Os Fidalgos da Casa Mourisca", author: "Júlio Dinis" },
  { id: 29120, title: "A Morgadinha dos Canaviais", author: "Júlio Dinis" },
  { id: 45966, title: "Eurico, o Presbítero", author: "Alexandre Herculano" },
  { id: 20841, title: "Os Pobres", author: "Raul Brandão" },
  { id: 39618, title: "Húmus", author: "Raul Brandão" },
  { id: 25537, title: "Paisagens da China e do Japão", author: "Wenceslau de Moraes" },
  { id: 2837, title: "Lendas do Sul", author: "João Simões Lopes Neto" },
  { id: 69239, title: "Era uma vez…", author: "Júlia Lopes de Almeida" },
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

/** Where a shelf stands (2026-11-18, founder: "shouldn't see the same ones over
 *  and over"): the books handed out this round, and the last few handed out. */
export type ShelfRotation = { round: string[]; recent: string[] };

export const EMPTY_ROTATION: ShelfRotation = { round: [], recent: [] };

/**
 * The next book off a shelf, shuffle-bag style: every book once, in a random
 * order, before any comes back; a new round starts clear of the last few, so a
 * book never follows itself across the seam.
 */
export function nextShelfBook(
  language: "en" | "es" | "de" | "pt",
  rotation: ShelfRotation,
  random: () => number = Math.random
): { book: MagpieBook; rotation: ShelfRotation } {
  const shelf = CURATED_SHELVES[language];
  const ids = shelf.map((entry) => String(entry.id));
  // The last few stay out even across a new round's first draws.
  const guard = rotation.recent.slice(-Math.min(5, Math.floor(shelf.length / 3)));
  // A book dropped from the shelf in an update no longer counts.
  let round = rotation.round.filter((id) => ids.includes(id));
  let eligible = shelf.filter((entry) => !round.includes(String(entry.id)) && !guard.includes(String(entry.id)));
  if (eligible.length === 0) {
    round = [];
    eligible = shelf.filter((entry) => !guard.includes(String(entry.id)));
  }
  const entry = eligible[Math.floor(random() * eligible.length)]!;
  const id = String(entry.id);
  return {
    book: toMagpieBook(entry),
    rotation: { round: [...round, id], recent: [...rotation.recent.filter((r) => r !== id), id].slice(-8) },
  };
}
