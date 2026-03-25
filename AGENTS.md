# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Huddle is a family meal planning PWA monorepo. See `replit.md` for full architecture, structure, and scripts reference.

### Required Services

| Service | Command | Port | Notes |
|---|---|---|---|
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | 5432 | Must be running before API server starts |
| API Server | `PORT=8080 DATABASE_URL="postgresql://ubuntu:ubuntu@localhost:5432/huddle" pnpm --filter @workspace/api-server run dev` | 8080 | Health check: `GET /api/healthz` |
| Huddle PWA | `PORT=20881 BASE_PATH=/ pnpm --filter @workspace/huddle run dev` | 20881 | Proxies `/api` to API server on port 8080 |

### Key Dev Commands

- **Install deps**: `pnpm install --frozen-lockfile`
- **Typecheck libs**: `pnpm run typecheck:libs` (clean)
- **Typecheck all**: `pnpm run typecheck` (pre-existing TS errors in `scripts/src/generate-recipes.ts` — not a blocker)
- **DB schema push**: `DATABASE_URL="postgresql://ubuntu:ubuntu@localhost:5432/huddle" pnpm --filter @workspace/db push`
- **Build all**: `pnpm run build`

### Non-Obvious Gotchas

- **Node.js 24 required**: The project specifies Node 24 in `replit.md`. Use `nvm use 24` (pre-installed in the VM).
- **Firebase credentials required**: The PWA uses Firebase Auth (email/password + Google sign-in) and Firestore for cross-device sync. You must set the `VITE_FIREBASE_*` env vars for the app to work. Without them, the app will show a spinner or crash on the auth screen. The six required env vars are: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- **pnpm only**: The root `package.json` has a `preinstall` script that rejects npm/yarn. Always use pnpm.
- **`pnpm approve-builds` is interactive**: Do not run it. The `pnpm-workspace.yaml` already has `onlyBuiltDependencies` configured for allowed packages.
- **DATABASE_URL is required**: The API server crashes on startup without it. Use the local PostgreSQL instance.
- **Family Plate (mobile) is optional**: The Expo/React Native app at `artifacts/family-plate` is not needed for core PWA development and has a known Metro crash bug.
