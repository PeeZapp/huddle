# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
This project is "Huddle" — a family meal planning app with a PWA-first approach.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (API server only)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/                   # Deployable applications
│   ├── api-server/              # Express API server (port 8080) — AI proxy at POST /api/ai
│   ├── huddle/                  # PWA React + Vite (port 20881) — ROOT path "/"
│   └── family-plate/            # Expo React Native app — MOBILE path "/mobile"
├── lib/                         # Shared libraries
│   ├── api-spec/                # OpenAPI spec + Orval codegen config
│   ├── api-client-react/        # Generated React Query hooks
│   ├── api-zod/                 # Generated Zod schemas from OpenAPI
│   └── db/                      # Drizzle ORM schema + DB connection
├── scripts/                     # Utility scripts
│   └── src/                     # Individual .ts scripts
├── pnpm-workspace.yaml          # pnpm workspace config
├── tsconfig.base.json           # Shared TS options
├── tsconfig.json                # Root TS project references
└── package.json                 # Root package with hoisted devDeps
```

## Huddle PWA (artifacts/huddle)

The primary product — a mobile-first PWA for family meal planning.

### Key Features
1. **Plan Tab** — Weekly meal planner (Mon-Sun), active meal slots (breakfast/lunch/dinner + extras)
2. **Shopping Tab** — Auto-generated + manual shopping list, grouped by category
3. **Recipes Tab** — Recipe library with search/filter, AI import from URL or text
4. **Lists Tab** — Custom family lists (grocery extras, to-dos, etc.)
5. **Nutrition Tab** — Daily/weekly nutrition tracking, goals, food log

### Architecture
- **Framework**: React + Vite + Tailwind CSS v4
- **State**: Zustand stores with localStorage persistence (web — NOT AsyncStorage)
- **Stores**: `src/stores/huddle-stores.ts` — familyStore, recipeStore, mealPlanStore, shoppingStore, listsStore, nutritionStore
- **Routing**: wouter — routes: /, /shopping, /recipes, /recipe/:id, /import, /generate, /nutrition, /lists, /family, /setup
- **Navigation**: Bottom tab bar (Plan, Shopping, Recipes, Lists, Nutrition)
- **AI**: `src/hooks/use-ai.ts` — POST /api/ai → API server proxies to Anthropic Claude
- **PWA**: vite-plugin-pwa, theme_color #639922, installable
- **Firebase**: Configured (env vars: VITE_FIREBASE_*) for cross-device sync (optional)

### Data Types (`src/lib/types.ts`)
- `Recipe`, `MealPlan`, `ShoppingItem`, `FamilyGroup`, `FoodLog`, `CustomList`, `NutritionGoals`
- `MealSlotKey`: breakfast | morning_snack | lunch | afternoon_snack | dinner | night_snack | dessert
- `Day`: monday | tuesday | wednesday | thursday | friday | saturday | sunday
- `DAYS`, `DAY_LABELS`, `MEAL_SLOTS` — exported constants

### Brand
- Primary green: `#639922` (hsl ~93, 58%, 36%)
- Family code format: `FP-XXXX`
- App name: "Huddle"

## API Server (artifacts/api-server)

Express server at port 8080.
- `POST /api/ai` — AI proxy to Anthropic Claude. Accepts `{ prompt, responseFormat: "json" | "text" }`, returns `{ result }`
- Uses `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (Replit AI integration)

## Expo App (artifacts/family-plate)

React Native app at `/mobile` path. Contains Firebase integration and all screens.
Note: Has intermittent Metro crash bug related to `_tmp_` directories in node_modules watch.

## Environment Variables

### PWA (VITE_ prefix for browser exposure)
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

### API Server
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit AI integration proxy URL
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Replit AI integration key

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`).
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck; actual JS bundling handled by esbuild/tsx/vite.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
