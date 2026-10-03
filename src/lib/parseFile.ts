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