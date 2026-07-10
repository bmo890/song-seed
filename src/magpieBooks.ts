import type { MagpieBook } from "./types";

/** The curated pool Magpie draws from by default — public-domain works from
 * Project Gutenberg, chosen for rich, varied prose and poetry across eras rather
 * than the reference material (dictionaries, indexes, legal codes) that a truly
 * random draw from the whole library would often surface. This is deliberately a
 * plain list of ids + display names; the page text is Range-fetched at runtime
 * from Gutenberg, never bundled. Prune or extend freely.
 *
 * `id` is the Project Gutenberg ebook id. `textUrl` points at the pre-generated
 * UTF-8 cache file, which serves HTTP Range requests directly (no redirect). */
export type CuratedBook = { id: number; title: string; author: string };

function gutenbergCacheTextUrl(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
}

/** Turn a curated entry into the runtime book shape carried on a spark. */
export function toMagpieBook(entry: CuratedBook): MagpieBook {
  return {
    id: String(entry.id),
    title: entry.title,
    author: entry.author,
    textUrl: gutenbergCacheTextUrl(entry.id),
  };
}

/** All ids verified present on Gutendex with a text/plain format. */
export const CURATED_BOOKS: CuratedBook[] = [
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
  { id: 500, title: "The Adventures of Pinocchio", author: "Carlo Collodi" },
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
  { id: 5200, title: "The Metamorphosis", author: "Franz Kafka" },
  { id: 7849, title: "The Trial", author: "Franz Kafka" },
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
  { id: 408, title: "The Souls of Black Folk", author: "W. E. B. Du Bois" },
  { id: 23, title: "Narrative of the Life of Frederick Douglass", author: "Frederick Douglass" },
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

/** A random curated book, as the runtime shape. */
export function randomCuratedBook(): MagpieBook {
  const entry = CURATED_BOOKS[Math.floor(Math.random() * CURATED_BOOKS.length)];
  return toMagpieBook(entry);
}
