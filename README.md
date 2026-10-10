# Leaflight

A personal reader for long `.txt` novels. Upload a raw text file and Leaflight splits it into chapters and shows it as readable paragraphs, in scroll or paged mode, with themes, fonts and sizes you control. The text itself is never modified; only how it is displayed changes.

Built for one user (me). It is not a public service.

## Features

- Automatic encoding detection (UTF-8, UTF-16, Windows-1258)
- Chapter detection (Vietnamese and English headings), with a size-based fallback
- Reader settings: theme (light / sepia / dark), font, size, line height, width, paragraph spacing
- Scroll mode and paged mode (swipe and tap zones on touch devices)
- Remembers reading position per book
- Cloud sync across devices (Cloudflare D1 + KV), with offline-capable PWA shell
- Local storage in IndexedDB; the cloud copy is optional

## Tech stack

React 19, TypeScript, Vite, React Router, Dexie (IndexedDB), Cloudflare Workers + D1 + KV.

## Run locally

```powershell
npm install
npm run dev
```

The dev server proxies `/api` to the deployed Worker (see `vite.config.ts`), so local development talks to the real cloud data.

## Deploy (Cloudflare)

One-time setup:

```powershell
npx wrangler d1 execute notebook-reader --remote --file=worker/schema.sql
npx wrangler secret put API_TOKEN
```

Then build and deploy:

```powershell
npm run build
npx wrangler deploy
```

## Security notes

- The API is protected by a single bearer token stored as the Cloudflare secret `API_TOKEN`. It is never committed to this repository.
- Enter the token once per device on the Sync page. It is kept in that browser's `localStorage`.
- To rotate it, run `npx wrangler secret put API_TOKEN` again and re-enter it on each device.

## Project structure

| Path | Purpose |
|---|---|
| `src/pages` | Library, Reader, Sync pages |
| `src/components` | Header, reader views, drawers, settings |
| `src/lib` | IndexedDB, settings, sync, UI state |
| `src/workers/parser.worker.ts` | Encoding and chapter detection (Web Worker) |
| `worker/` | Cloudflare Worker API and D1 schema |
| `public/sw.js` | Service worker (offline app shell) |