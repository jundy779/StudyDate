<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- The web app is `npm run dev` at http://localhost:3010. Open `localhost`, not `127.0.0.1`. Next.js treats `127.0.0.1` as a cross-origin dev host and blocks `/_next` assets, so the page stays static.
- Root install is `npm ci`. The Expo app in `mobile/` needs `npm ci --prefix mobile --legacy-peer-deps`; plain `npm ci` there fails peer resolution.
- `npm run lint`, `npm run typecheck`, `npm run test:all`, and `npm run build` are the web checks. Mobile typecheck is `npm run typecheck` in `mobile/`.
- Public pages and the Node test suite run without Supabase environment variables. Copy `.env.example` to `.env.local` only when a dedicated StudyDate project is available. Early Access persistence and authenticated routes fail closed until those values are set. Do not point them at an unrelated project.
