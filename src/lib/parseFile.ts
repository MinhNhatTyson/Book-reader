import type { Chapter } from './db'

export interface ParseResult {
  text: string
  encoding: string
  chapters: Chapter[]
}

export function parseFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ParseResult>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (e) => {
      reject(e)
      worker.terminate()
    }
    worker.postMessage(file)
  })
}

export interface ResplitOptions {
  mode: 'auto' | 'pattern' | 'size'
  pattern?: string
  size?: number
}

export function resplit(text: string, opts: ResplitOptions): Promise<Chapter[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ chapters?: Chapter[]; error?: string }>) => {
      worker.terminate()
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.chapters ?? [])
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e)
    }
    worker.postMessage({ text, ...opts })
  })
}