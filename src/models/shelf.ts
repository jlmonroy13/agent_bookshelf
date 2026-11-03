import { all, get, run } from '../db/index.js';

export interface Shelf {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

export interface ShelfWithBooks extends Shelf {
  username: string;
  books: ShelfBook[];
}

export interface ShelfBook {
  book_id: number;
  added_at: string;
  title: string;
  author: string;
}

export function getShelvesByUserId(userId: number): Shelf[] {
  return all(
    'SELECT * FROM shelves WHERE user_id = ? ORDER BY name',
    [userId]
  ) as unknown as Shelf[];
}

export function getShelfById(id: number): Shelf | undefined {
  return get('SELECT * FROM shelves WHERE id = ?', [id]) as unknown as Shelf | undefined;
}

export function getShelfWithBooks(shelfId: number): ShelfWithBooks | undefined {
  const shelf = get(`
    SELECT s.*, u.username
    FROM shelves s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `, [shelfId]) as unknown as (Shelf & { username: string }) | undefined;

  if (!shelf) return undefined;

  const books = all(`
    SELECT sb.book_id, sb.added_at, b.title, b.author
    FROM shelf_books sb
    JOIN books b ON sb.book_id = b.id
    WHERE sb.shelf_id = ?
    ORDER BY b.title
  `, [shelfId]) as unknown as ShelfBook[];

  return { ...shelf, books };
}

export function createShelf(userId: number, name: string): Shelf {
  const result = run('INSERT INTO shelves (user_id, name) VALUES (?, ?)', [userId, name]);
  return getShelfById(result.lastInsertRowid)!;
}

export function deleteShelf(id: number): boolean {
  const result = run('DELETE FROM shelves WHERE id = ?', [id]);
  return result.changes > 0;
}

export function addBookToShelf(shelfId: number, bookId: number): boolean {
  const existing = get(
    'SELECT 1 FROM shelf_books WHERE shelf_id = ? AND book_id = ?',
    [shelfId, bookId]
  );

  if (existing) return false;

  run(
    'INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)',
    [shelfId, bookId]
  );
  return true;
}

export function removeBookFromShelf(shelfId: number, bookId: number): boolean {
  const result = run(
    'DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?',
    [shelfId, bookId]
  );
  return result.changes > 0;
}

export function getShelvesForBook(userId: number, bookId: number): Shelf[] {
  return all(`
    SELECT s.*
    FROM shelves s
    JOIN shelf_books sb ON s.id = sb.shelf_id
    WHERE s.user_id = ? AND sb.book_id = ?
    ORDER BY s.name
  `, [userId, bookId]) as unknown as Shelf[];
}

export type MarkBookAsReadResult =
  | { success: true; shelfId: number; alreadyRead: boolean }
  | { success: false; error: 'user_not_found' | 'book_not_found' | 'read_shelf_not_found' };

/** Moves a book onto the user's pre-seeded `read` shelf (no schema change). */
export function markBookAsRead(userId: number, bookId: number): MarkBookAsReadResult {
  const user = get('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) {
    return { success: false, error: 'user_not_found' };
  }

  const book = get('SELECT id FROM books WHERE id = ?', [bookId]);
  if (!book) {
    return { success: false, error: 'book_not_found' };
  }

  const readShelf = get(
    "SELECT * FROM shelves WHERE user_id = ? AND name = 'read'",
    [userId]
  ) as unknown as Shelf | undefined;

  if (!readShelf) {
    return { success: false, error: 'read_shelf_not_found' };
  }

  run(
    `DELETE FROM shelf_books
     WHERE book_id = ? AND shelf_id IN (
       SELECT id FROM shelves WHERE user_id = ? AND name IN ('want-to-read', 'currently-reading')
     )`,
    [bookId, userId]
  );

  const onReadShelf = get(
    'SELECT 1 FROM shelf_books WHERE shelf_id = ? AND book_id = ?',
    [readShelf.id, bookId]
  );

  if (onReadShelf) {
    return { success: true, shelfId: readShelf.id, alreadyRead: true };
  }

  run('INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [readShelf.id, bookId]);
  return { success: true, shelfId: readShelf.id, alreadyRead: false };
}
