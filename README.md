# WhoIsFree

**Free time. Real people. Real experiences.**

Android app (Expo SDK 58 / React Native, expo-router) to tell people nearby you are free right now and turn free time into real activities.

## Status (test build)
- Frontend: 5 tabs (Home, Radar, Create, Messages, Profile) + onboarding, auth, availability, people, chat, activities, Surprise me, Live moments, notifications, settings, safety, plans overview, admin. EN / FR / AR (RTL).
- Backend: Supabase, tables prefixed `wif_` (see `supabase/migrations`). Locations are snapped to a ~2 km grid server-side; clients only ever receive distance bands.
- Not active yet: paid plans (no RevenueCat / Play products configured, no prices shown), push notifications, AI assistant, marketplace.

## Build
Every push to `main` builds a release APK (`.github/workflows/android-apk.yml`) and publishes it as a GitHub release `build-N`.

Only publishable keys are used in the app. Never put a service-role key in the app or this repo.
