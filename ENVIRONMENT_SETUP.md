# Environment Setup

This project uses two runtime environments:

- `artifacts/api-server` (backend, private secrets)
- `artifacts/huddle` (frontend, public-safe client config)

## 1) API server env vars (`artifacts/api-server`)

Copy example:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Required for AI features:

- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`

Important:

- Use `https://api.anthropic.com` for base URL (without `/v1`).
- API code appends `/v1/messages` internally.

Other supported vars:

- `PORT` (default `8080`)
- `REQUIRE_MEAL_PHOTO_CREDITS` (`false` for open beta, `true` to enforce credits)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## 2) Frontend env vars (`artifacts/huddle`)

Copy example:

```bash
cp artifacts/huddle/.env.example artifacts/huddle/.env.local
```

Required Firebase client vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## 3) Cross-device / deployed setup

For multi-device production behavior:

- Set API env vars in your backend host dashboard (Render/Railway/Cloud Run/etc.).
- Set frontend `VITE_*` vars in your frontend hosting build settings.
- Do not commit real secrets to git; keep only `.env.example` placeholders.

## 4) Meal photo analysis checklist

Meal photo analysis works when all are true:

1. API server is running.
2. Anthropic base URL + API key env vars are configured in API runtime.
3. Frontend can call `/api/ai/meal-photo/analyze`.
4. User confirms analysis in the Health page UI.
