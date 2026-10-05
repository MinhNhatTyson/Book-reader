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
  lastReadAt?: number
  remoteId?: string     // id of this book in the cloud
  uploaded?: boolean    // true once text + chapters are in the cloud
  progressAt?: number   // when `progress` last changed (used to pick the newest position)
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
db.version(3).stores({ books: '++id, title, createdAt, remoteId', texts: 'id' })

export async function deleteBook(id: number) {
  await db.transaction('rw', db.books, db.texts, async () => {
    await db.books.delete(id)
    await db.texts.delete(id)
  })
  if (localStorage.getItem('last-read') === String(id)) localStorage.removeItem('last-read')
}