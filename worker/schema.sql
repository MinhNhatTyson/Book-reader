CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  encoding TEXT,
  chapters TEXT NOT NULL DEFAULT '[]',
  chapter_count INTEGER NOT NULL DEFAULT 0,
  chapters_at INTEGER NOT NULL DEFAULT 0,
  bookmarks TEXT NOT NULL DEFAULT '[]',
  bookmarks_at INTEGER NOT NULL DEFAULT 0,
  progress_chapter INTEGER,
  progress_ratio REAL,
  progress_at INTEGER,
  ready INTEGER NOT NULL DEFAULT 0
);