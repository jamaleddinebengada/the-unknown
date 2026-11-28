/** Draft texts — must be reviewed by a lawyer (Morocco law 09-08 / CNDP, GDPR where applicable) before public launch. */
export const LEGAL: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Use (draft)',
    body: `WhoIsFree helps adults (18+) meet people nearby for real-world activities.

1. Eligibility — You must be at least 18 years old. Accounts of minors are removed.
2. Your account — Give accurate information and use only photos of yourself. You are responsible for activity on your account.
3. Meeting people — Meet in public places. WhoIsFree does not run background checks; verification badges do not guarantee anyone's identity or behaviour.
4. Content — You keep ownership of what you post and give WhoIsFree a licence to display it in the app. Do not post illegal, hateful, sexual, violent or misleading content.
5. Activities — Hosts are responsible for the accuracy of their activities. Paid experiences are not active yet.
6. Subscriptions — When available, subscriptions are billed by Google Play / Apple and can be cancelled in your store account.
7. Moderation — We may remove content or suspend accounts that break these rules or the Community Guidelines.
8. Liability — The service is provided "as is". To the extent permitted by law, WhoIsFree is not liable for interactions between members.
9. Changes — We will notify you of important changes.`,
  },
  privacy: {
    title: 'Privacy Policy (draft)',
    body: `What we collect: email (sign-in), profile details you enter (name, date of birth, gender, bio, interests, languages, photos), your approximate area (rounded to about 2 km), availability you publish, messages, activities and reports.

What we never collect or show: your exact GPS position, contacts, or data from other apps.

How location works: your phone sends its position once when you choose "Use my location"; the server immediately rounds it to a ~2 km grid cell and stores only that cell. Other members only see a distance band (for example "5–10 km"). You can erase your area at any time (Settings → Location).

Why: to show who is free near you, run activities and chat, keep the community safe and prevent abuse.

Sharing: we do not sell personal data. Data is hosted by Supabase (EU region). Store payments are processed by Google / Apple.

Your rights: access, correction and deletion. Settings → Delete my account removes your WhoIsFree profile, photos, activities and messages.

Retention: deleted accounts are removed from active systems immediately; backups expire on the provider's schedule.

Contact: see Help.`,
  },
  guidelines: {
    title: 'Community Guidelines',
    body: `Be real — your own photos, your real age (18+).
Be kind — no harassment, hate, threats or unwanted sexual messages.
Meet safely — public places, tell a friend, leave if you feel uncomfortable.
No spam, scams, sales or recruitment.
No violence, weapons, drugs or illegal activities.
Respect "no" — a declined request is final.
Report anything that feels wrong; reports are confidential.`,
  },
};
