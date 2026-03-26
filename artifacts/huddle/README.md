# Huddle Web App (PWA)

This package is the production web client for Huddle, built with React + Vite.
It is configured as an installable Progressive Web App (PWA) with offline caching.

## Run locally

From the workspace root:

```bash
pnpm --filter @workspace/huddle run dev
```

Build for production:

```bash
pnpm --filter @workspace/huddle run build
```

Typecheck:

```bash
pnpm --filter @workspace/huddle run typecheck
```

## Environment Variables

Use the env templates and setup notes at:

- `artifacts/huddle/.env.example`
- `artifacts/api-server/.env.example`
- `ENVIRONMENT_SETUP.md`

## PWA foundation

The app uses `vite-plugin-pwa` with:

- Web App Manifest metadata for installability
- Service worker registration from `src/main.tsx`
- Runtime caching for pages, static assets, and images
- Network-only strategy for `/api/*` calls
- App icons for Android and iOS (`public/pwa-*.png`, `public/apple-touch-icon.png`)

## Native iOS and Android path after PWA

After validating the PWA behavior, package this web app into native shells using Capacitor.

### 1) Add Capacitor to this package

```bash
pnpm --filter @workspace/huddle add @capacitor/core
pnpm --filter @workspace/huddle add -D @capacitor/cli @capacitor/ios @capacitor/android
```

### 2) Initialize Capacitor

Run from `artifacts/huddle`:

```bash
npx cap init Huddle com.huddle.app --web-dir=dist
```

### 3) Build and sync native projects

```bash
pnpm run build
npx cap add ios
npx cap add android
npx cap sync
```

### 4) Open native IDE projects

```bash
npx cap open ios
npx cap open android
```

## Notes for native packaging

- Keep API endpoints HTTPS in production.
- Test service worker updates on real devices.
- Configure app icons/splash screens per platform requirements.
- Add native plugins (push notifications, camera, storage) only after PWA parity is stable.
