# Mobile production builds (EAS)

Vendorly ships as a **Supabase-only** shopper app — no NestJS backend required. Set production env vars as **EAS secrets**, never commit them to git.

## Prerequisites

- [Expo account](https://expo.dev/signup)
- Apple Developer account (iOS App Store / TestFlight)
- Google Play Console account (Android)
- Supabase project with `phase22` + auth migrations applied

## One-time setup

```powershell
cd mobile
npm install
npm install -g eas-cli
eas login
eas init
```

`eas init` links the app to your Expo project and adds `extra.eas.projectId` to `app.json`. Commit that project id — it is not a secret.

Copy env template for local dev:

```powershell
copy .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` locally. For EAS builds, use secrets instead (next section).

## EAS secrets (production)

Create secrets once per Expo project. Replace values with your Supabase project details:

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-REF.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR-ANON-KEY"
eas secret:create --scope project --name EXPO_PUBLIC_AUTH_REDIRECT_URL --value "https://YOUR-REF.supabase.co/storage/v1/object/public/auth/auth-redirect.html"
```

Optional:

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_APP_URL --value "https://your-app.vercel.app"
```

List secrets: `eas secret:list`

## Build commands

**Preview** (internal testing — Android APK, iOS ad-hoc/TestFlight internal):

```powershell
eas build --profile preview --platform android
eas build --profile preview --platform ios
eas build --profile preview --platform all
```

**Production** (store-ready, auto-increments build numbers):

```powershell
eas build --profile production --platform android
eas build --profile production --platform ios
```

Download builds from the Expo dashboard or install via QR code when the build finishes.

## Submit to stores (optional)

After a production build succeeds:

```powershell
eas submit --platform ios --latest
eas submit --platform android --latest
```

Configure App Store Connect / Play Console credentials when prompted (`eas credentials`).

## Verify before shipping

```powershell
npx tsc --noEmit
```

Test auth (email + OAuth), map, markets list, and discover search against production Supabase.

## Notes

- Bundle IDs: `com.vendorly.marketplace` (iOS + Android) — set in `app.json`.
- OAuth redirect: `vendorly://auth/callback` — add in Supabase Auth → URL Configuration.
- `EXPO_PUBLIC_API_URL` is **not** required for shopper flows; leave unset for Supabase-only builds.
