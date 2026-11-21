# THE UNKNOWN

*Meet the unknown. Discover the unexpected.*

React Native · Expo SDK 58 · TypeScript · Expo Router · Reanimated 4 · Supabase (Postgres + RLS, Realtime, Storage, Edge Functions)

## Run it

```bash
npm install
cp .env.example .env          # add your Supabase URL + anon key
npx expo start                # press a (Android) / i (iOS)
```

Native modules such as Apple Sign-In, audio recording and haptics need a **development build**:
`npx expo run:android`, or `npx eas-cli@latest build --profile development`.

Without `.env`, the app runs in **preview mode**. A yellow banner says the backend is not connected, and every action shows that message instead of pretending to work.

## Backend setup (Supabase)

1. Create a project at supabase.com.
2. Run `supabase/migrations/20261121000000_init.sql` (SQL editor, or `supabase db push`).
3. **Auth → Providers:** enable Email. Enable Google and Apple if you want them, and add `theunknown://auth/callback` to the Redirect URLs.
4. AI assist (optional): `supabase functions deploy ai-assist` then `supabase secrets set ANTHROPIC_API_KEY=...`

### Required credentials
| Credential | Where | Needed for |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | everything |
| Google OAuth client ID/secret | Supabase Auth → Google | Google sign-in |
| Apple Services ID + key | Supabase Auth → Apple | Apple sign-in (iOS) |
| `ANTHROPIC_API_KEY` | Supabase secret | AI post / conversation assist |
| RevenueCat keys | Phase 5 | UNKNOWN PLUS subscriptions |

## Security model
- Every table has RLS enabled. Clients can read **only their own rows** directly.
- Reads that cross users go through `SECURITY DEFINER` RPCs. These return anonymised fields only (`UNKNOWN #number`, country, age range). Other users' internal UUIDs, birth dates and emails are never returned.
- Privileged columns (`is_premium`, `status`, `is_admin`, counters) are protected with column-level grants, so clients cannot write them.
- Conversations are created only by `respond_interest` (the post owner accepts) or `respond_match` (both people accept). There are no unsolicited DMs.
- Identity reveal (`set_reveal_consent` / `get_revealed_identity`) needs consent from both people. Each person chooses which fields to share.
- Blocking ends direct conversations, hides content in both directions and stops messages from being sent.
- Rate limits are enforced in triggers for posts, comments, messages, interests and reports.
- 18+ is enforced in the database.
- Reports are anonymous. A post reported by 5 or more different people is auto-hidden until a human reviews it.

The migration was run against PostgreSQL 16. An end-to-end test covered: two users, post, feed, like, comment, interest, accept, chat, mystery match, reveal, block, search, and blocked privilege-escalation attempts.

## Structure
```
src/app/            routes (Expo Router)
src/components/     design-system components (ui, PostCard, AnimatedTabBar, AnonymousAvatar, BottomSheet, Toast…)
src/features/       auth provider, profile form, reveal flow
src/hooks/ src/services/ src/lib/ src/constants/ src/types/ src/utils/
supabase/           migration + ai-assist edge function
```

## Build status

| Phase | Status |
|---|---|
| 1. Design system, splash, onboarding, auth, profile setup, interests, Discover feed, navigation | ✅ |
| 2. Create/edit post (image, voice, AI assist), post details, likes, comments, Interested system | ✅ |
| 3. Mystery Match (6 modes), conversation requests, realtime chat (typing, presence, prompts), reveal | ✅ core. Image and voice messages in chat are still to do. |
| 4. Messages center, notifications, search | ✅ Connections screen, topic pages and world map are still to do. |
| 5. UNKNOWN PLUS (RevenueCat), translation UI | ⏳ |
| 6. Settings (privacy, blocked users, delete account) | ✅ |
| 6. Admin dashboard, push notifications, i18n (FR/AR RTL/ES), light mode | ⏳ |
| 7. Device testing on Android/iOS | ⏳ |

Account deletion removes all database rows through a cascade. Deleting the user's storage files still needs an `account-cleanup` edge function, because Supabase blocks direct deletes on `storage.objects`.
