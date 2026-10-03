import Dexie, { type EntityTable } from 'dexie'

export interface Chapter {
  title: string
  start: number // character offset into the text (inclusive)
  end: number   // character offset (exclusive)
}

export interface Book {
  id: number
  title: string
  size: number
  createdAt: number
  encoding?: string
  chapters?: Chapter[]
  progress?: { chapter: number; ratio: number }
}

export interface BookText {
  id: number // same id as the Book
  text: string
}

export const db = new Dexie('notebook-reader') as Dexie & {
  books: EntityTable<Book, 'id'>
  texts: EntityTable<BookText, 'id'>
}

db.version(1).stores({ books: '++id, title, createdAt' })
db.version(2).stores({ books: '++id, title, createdAt', texts: 'id' })

export async function deleteBook(id: number) {
  await db.transaction('rw', db.books, db.texts, async () => {
    await db.books.delete(id)
    await db.texts.delete(id)
  })
}